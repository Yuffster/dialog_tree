class Markov {

    constructor(size=2) {
        this._nodes = false;
        this._size = size;
        this._worker = new WorkerAPI('markov_worker');
    }

    getCount(fun) {
        var req = this._worker.request('count');
        if (fun) req.on('done', fun);
        req.start();
    }

    clearCorpus(fun) {
        var req = this._worker.request('clearCorpus');
        if (fun) req.on('done', fun);
        req.start();
    }

    getRandomNode(fun) {
        var req = this._worker.request('getRandomNode');
        if (fun) req.on('done', fun);
        req.start();
    }

    integrate(txt, funs) {
        funs = funs || {};
        var req = this._worker.request('integrate', txt, this._size);
        for (let evt in funs) req.on(evt, funs[evt]);
        req.start();
    }

    getNode(key, fun) {
        var req = this._worker.request('get', key);
        if (fun) req.on('done', fun);
        req.start();
    }

    getNodesFollowing(word, fun) {
        this.getNode(word, (node) => {
            if (!node) return [];
            var total = 0,
                probs = {};
            for (let k in node) {
                total += node[k];
            }
            for (let k in node) {
                probs[k] = Math.floor(node[k]/total*100)/100;
            }
            if (fun) fun(probs);
        });
    }

    selectNextWord(word, fun) {
        var node = this.getNode(word, () => {
            if (node === undefined) fun(false);
            var total = 0,
                nums  = [],
                vals  = [];
            for (let w of node) {
                total += node[w];
                nums.push(total);
                vals.push(w);
            }
            var n = Math.floor(Math.random() * total);
            for (let i in nums) {
                if (nums[i] >= n) fun(i);  
            }
            if (fun) fun();
        });
    }

}
