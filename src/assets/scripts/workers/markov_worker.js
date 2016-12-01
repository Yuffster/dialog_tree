// Web Worker for Markov.

let prefix = ""; // Incoming command prefix.
let namespace = "_markovv"; // Storage namespace.
var db = false;

let loop = false;
onmessage = function(e) {
    // We're expecting the data packet to be an array we can
    // pop from.
    if (!e.data || !e.data.splice) {
        return;
    }
    var pre = e.data[0];
    // Is this a command to set the prefix?
    if (pre == "__WKRPREFIX") {
        prefix = e.data[1];
    // Does it have the prefix we're expecting?
    } else if (pre == prefix) {
        // Then make an event loop and send it to the handler.
        var [id, command, args] = e.data[1];
        loop = loop || new EventLoop();
        loop.add(id, command, args);
    }
};

// These things need to return an estimate of the number of iterations,
// and the generator (or the result).
var API = {
    count: function(n) {
        /**
         * Example generator - - the deal here is that your API handlers
         * return a generator and their total.
         * If no generator, just return the value.
         */
        var gen = (function*(){ 
            for (let i=1;i<=n;++i) yield(i);
        }());
        return [gen, n];
    },
    echo: function(str) {
        /**
         * If no generator, just return the value.
         *
         * Though if it's long enough to justify putting into a Web Worker,
         * you should really yield the current progress.
         */
        return str;
    },
    async: function(n) {
        /**
         * Async generator example -- if you need to wait for a callback,
         * return a Deferred and call d.callback when you're ready.
         */
        var gen = (function*(){
            for (let i=1;i<=n;++i) {
                let d = new Deferred();
                let c = i;
                setTimeout(function() { d.callback(c); }, 100);
                yield(d);
            }
        }());
        return [gen, n];
    },
    get: function(key) {
        return db.get(key);
    },
    set: function(key, val) {
        return db.set(key, val);
    }
}

class Deferred {
    callback(data) {
        this._result = data;
        if (this._oncomplete) this._oncomplete(data);
    }
    set oncomplete(fun) {
        if (this._result) fun(result);
        else this._oncomplete = fun;
    }
}

class EventLoop {

    constructor(interval=1000) {
        this._generators = new Map();
        this._counts = new Map();
        this._active = false;
        this._interval = interval;
    }

    /**
     * Run a command and add any returned generator to the generators
     * array so we can loop through it on every step until it's depleted.
     *
     * id is the handler ID that comes in from the window process. 
     */
    add(id, cmd, args) {
        if (!API[cmd]) { // Womp womp.
            console.error(prefix, "Invalid command:", cmd);
            return;
        }
        // Run the command.
        var result = API[cmd].apply(null, args);
        // If we get a generator, add that to our generators so we can
        // step through it.
        //
        // We're expecting a generator command to return an array
        // containing [generator, total].
        if (result[0] && result[0].next) {
            let [gen, total] = result;
            let counter = {current:0, total:total};
            postMessage([id, 'start', [total]]);
            this._generators.set(id, gen);
            this._counts.set(id, counter);
            this._run_loop();
        // Or we're waiting on a callback...
        } else if (result instanceof Deferred) {
            result.oncomplete = (r) => postMessage([id, 'done', [r]]);
        // If we didn't get a generator, just send the result.
        } else {
            postMessage([id, 'done', [result]]);
        }
    }

    _run_loop() {
        // Loop through all the generators and send a progress update to
        // the handler ID.
        for (let [id, gen] of this._generators.entries()) {
            let {value, done} = gen.next();
            let c = this._counts.get(id);
            value = value || null;
            // If we returned a deferred object from the generator because
            // we're waiting on an async call.
            if (value instanceof Deferred) {
                value.oncomplete = (v) => {
                    postMessage([id, 'progress', [v, c.current, c.total]]);
                };
                c.current++;
            // Otherwise just post the yielded value.
            } else {
                postMessage([id, 'progress', [value, c.current, c.total]]);
                if (done == true) {
                    postMessage([id, 'done', [value]]);
                    this._generators.delete(id);
                    this._counts.delete(id);
                } else c.current++;
            }
        }
        // If we have at least one active generator, set an interval so
        // this will be called again.
        if (this._generators.size > 0) {
            this._active = true;
            setTimeout(()=>{ this._run_loop(); }, this._interval);
        // Otherwise, just chill until we get some other command.
        } else {
            this._active = false;
        }
    }

}

class DB {

    constuctor() {

    }

    _getDB(fun) {
        var open = indexedDB.open(namespace, 1);
        open.onupgradeneeded = () => this._setSchema(open.result);
        if (fun) open.onsuccess = () => fun(open.result);
    }

    _setSchema(db) {
        var store = db.createObjectStore(namespace, {keyPath: "id"});
    }

    set(key, val, fun) {
        var d = null;
        if (!fun) {
            d = new Deferred();
            fun = d.callback;
        }
        this._getDB((db) => {
            var tx = db.transaction(namespace, "readwrite");
            var store = tx.objectStore(namespace);
            store.put({id: key, data: val});
            tx.oncomplete = function() {
                fun.apply(d, [true]);
                db.close();
            };
        });
        if (d) return d;
    }

    get(key, fun) {
        var d = null;
        if (!fun) {
            d = new Deferred();
            fun = d.callback;
        }
        this._getDB((db) => {
            var tx = db.transaction(namespace, "readwrite");
            var store = tx.objectStore(namespace);
            var get = store.get(key);
            get.onsuccess = () => {
                var result = (get.result) ? get.result.data : false;
                if (result) {
                    fun.apply(d, [result]);
                } else {
                    fun.apply(d, []);
                }
            }
            tx.oncomplete = () => db.close();
        });
        if (d) return d;
    }

}

db = new DB();