/**
 * Simple interface for initializing Web Workers, running commands on
 * them, and attaching events to the commands.
 *
 *     var api = WorkerAPI();
 *     var req = api.request('count', 5);
 *     req.on('progress', function(result, index, total) {
 *         console.log("got result", result);
 *         console.log("processed", index, "of", total);
 *         console.log(Math.floor(index/total*100)+"% complete");
 *     });
 */
class WorkerAPI {

    /**
     * Load a webworker and get a simple request interface that keeps
     * track of execution progress via generators in the webworker.
     */
    constructor(name, cmdPrefix="") {
        // Send the command prefix to the worker.
        this._prefix = cmdPrefix || name.toUpperCase();
        this._worker = new Worker("/assets/scripts/workers/"+name+'.js');
        this._worker.postMessage(['__WKRPREFIX', this._prefix]);
        // Set up event handler.
        this._worker.onmessage = (e) => this._handleMessage(e);
        this._reqs = [];
    }

    /**
     * Create a new WorkerRequest.
     *
     * Requests emit the following events:
     *
     *   - start(total)
     *
     *        Posted if a generator is started by the command handler
     *        for this request.
     *
     *   - progress(result, current, total)
     *
     *        Last yield value, the current cursor, and the total number
     *        of items.
     *
     *   - done(result)
     *
     *        Fired after the generator finishes executing. Returns the
     *        final yielded value.
     *
     * The request isn't sent immediately.  Set your callbacks and then
     * call req.send().
     *
     */
    request(command, ...args) {
        var id = this._reqs.length;
        this._reqs.push(new WorkerRequest(id, this, [command, args]));
        return this._reqs[id];
    }

    _handleMessage(mes) {
        var [id, type, args] = mes.data;
        args = args || [];
        if (!this._reqs[id]) return;
        this._reqs[id]._handleMessage.apply(this._reqs[id], [type, args]);
    }

    /**
     * Send a message to the web worker.
     */
    _postMessage(worker_id, req="") {
        var [command, args] = req;
        var p = [worker_id, command, args];
        this._worker.postMessage([this._prefix, p]);
    }

}

/**
 * A simple interface for setting event handlers and then starting
 * a given request to a web worker.
 */
class WorkerRequest {

    constructor(id, api, req) {
        this._id = id;
        this._api = api;
        this._req = req;
        this._events = {};
    }

    start() {
        this._api._postMessage.apply(this._api, [this._id, this._req]);
    }

    on(evt, fn) {
        this._events[evt] = fn;
    }

    _handleMessage(evt, args) {
        if (!this._events[evt]) return;
        this._events[evt].apply(null, args);
    }

}