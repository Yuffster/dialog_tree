// Web Worker for Markov.

let prefix = ""; // Incoming command prefix.
let namespace = "_dialog"; // Storage namespace.
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
        var d = new Deferred();
        db.get(key, (r) => {
            var res = (r && r.data) ? r.data : {};
            if (r) d.callback(res);
        });
        return d;
    },
    set: function(key, val) {
        return db.set(key, val);
    },
    count: function() {
        return db.count();
    },
    getRandomNode() {
        var d = new Deferred();
        db.count((c) => {
            var id = Math.floor(Math.random()*(c-1))+1;
            db.get(id, (r)=>{
                d.callback(r.node);
            }, true)
        });
        return d;
    },
    integrate: integrate
}

function integrate(text, size=1) {
    db = db || new DB();
    var chunks = chunk(text, size);
    var gen = (function* g() {
        var prev = false;
        for (let word of chunks) {
            var d = new Deferred();
            // Add to total of times this word has followed the previous.
            if (prev !== false) {
                prev[word] = prev[word] || 0;
                prev[word]++;
                db.set(prev_word, prev);
            }
            prev_word = word;
            var d = new Deferred();
            db.get(prev_word, (r) => {
                prev = (r) ? r.data : {};
                if (!r) {
                    db.set(prev_word, {}, ()=> d.callback(prev_word));
                } else {
                    d.callback(r.node);
                }
            });
            yield d;
        }
    }());
    return [gen, chunks.length];
};


function chunk(txt, size=1) {
    var out = [];
    for (let i = 0; i<size+1; i++) {
        let arr = txt.split(/\s+?([\w?!.']*)\s+?/g);
        // Remove one element to shift words.
        // This increases the effective corpus size.
        if (i > 0) arr.splice(0, i);
        while(arr.length>0) {
            if (arr.length<size) continue;
            out.push(arr.splice(0, size).join(" "));
        }
    }
    return out;
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

    constructor(interval=100) {
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
        if (Array.isArray(result) && result[0] && result[0].next) {
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

    _getDB(fun) {
        var open = indexedDB.open(namespace, 1);
        open.onupgradeneeded = () => this._setSchema(open.result);
        if (fun) open.onsuccess = () => fun(open.result);
    }

    _setSchema(db) {
        var store = db.createObjectStore(
            namespace, {
                keyPath: "id",
                autoIncrement: true
            }
        );
        store.createIndex("nodeIndex", ["node"]);
    }

    set(key, val, fun) {
        var d = null;
        if (!fun) {
            d = new Deferred();
            fun = d.callback;
        }
        this.get(key, (result) => {
            if (!result) result = {'node':key, 'data':{}};
            this._getDB((db) => {
                var tx = db.transaction(namespace, "readwrite");
                var store = tx.objectStore(namespace);
                result.data = val;
                var req = store.put(result);
                req.onsuccess = () => {
                    fun.apply(d, [true]);
                };
                tx.oncomplete = function() {
                    result.data = val;
                    db.close();
                };
            });
        });
        if (d) return d;
    }

    get(key, fun, indexed=false) {
        var d = null;
        if (!fun) {
            d = new Deferred();
            fun = d.callback;
        }
        this._getDB((db) => {
            var tx = db.transaction(namespace, "readwrite");
            var store = tx.objectStore(namespace);
            var get;
            if (indexed) get = store.get(key);
            else get = store.index('nodeIndex').get([key]);
            get.onsuccess = () => {
                var result = (get.result) ? get.result : false;
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

    count(fun) {
        var d = null;
        if (!fun) {
            d = new Deferred();
            fun = d.callback;
        }
        this._getDB((db) => {
            var tx = db.transaction(namespace, "readwrite");
            var store = tx.objectStore(namespace);
            var req = store.count();
            req.onsuccess = () => fun.apply(d, [req.result]);
            tx.oncomplete = () => db.close();
        });
        if (d) return d;
    }

}

db = new DB();