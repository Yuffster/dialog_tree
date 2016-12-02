class Markov {

    constructor(size=2) {
        this._nodes = false;
        this._size = size;
        this._storage_namespace = "_mk"+size+"_";
        this._worker = new WorkerAPI('markov_worker');
    }

    getRandomNode(fun) {
        var req = this._worker.request('getRandomNode');
        if (fun) req.on('done', fun);
        req.start();
    }

    integrate(txt, fun) {
        var req = this._worker.request('integrate', txt, 2);
        req.on('progress', function(v, i, t) {
            console.log(v, Math.floor(i/t*100)+"% complete");
        });
        req.on('done', function(v) {
            console.log('done integrating');
            if (fun) fun(v);
        });
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
