class WorkerAPI {

    constructor(workerName, cmdPrefix="") {
        this._prefix = cmdPrefix;
        this._worker = new Worker("/scripts/"+workerName+'.js');
        this._worker.onmessage = (e) => this._handleMessage(e);
        this._reqs = [];
    }

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

    send(worker_id, req="") {
        var [command, args] = req;
        var p = JSON.stringify([worker_id, command, args]);
        this._worker.postMessage(this._prefix+p);
    }

}

class WorkerRequest {

    constructor(id, api, req) {
        this._id = id;
        this._api = api;
        this._req = req;
        this._events = {};
    }

    start() {
        this._api.send.apply(this._api, [this._id, this._req]);
    }

    on(evt, fn) {
        this._events[evt] = fn;
    }

    _handleMessage(evt, args) {
        if (!this._events[evt]) return;
        this._events[evt].apply(null, args);
    }

}