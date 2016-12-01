// Web Worker for Markov.

let prefix = ""; // Incoming command prefix.
var namespace = ""; // localStorage key namespace.

var loop = false;
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
        // If we didn't get a generator, just send the result.
        } else postMessage([id, 'done', [result]]);
    }

    _run_loop() {
        // Loop through all the generators and send a progress update to
        // the handler ID.
        for (let [id, gen] of this._generators.entries()) {
            let {value, done} = gen.next();
            value = value || null;
            let c = this._counts.get(id);
            postMessage([id, 'progress', [value, c.current, c.total]]);
            if (done == true) {
                postMessage([id, 'done', [value]]);
                this._generators.delete(id);
                this._counts.delete(id);
            } else c.current++;
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