class Markov {

    constructor(size=2) {
        this._nodes = [];
        this._size = size;
        this._storage_namespace = "_mk"+size+"_";
    }

    loadStorage() {
        var p = new RegExp('^'+this._storage_namespace+".*?");
        for (let k in localStorage) {
            this._nodes.push(k.replace(p, ''));
        }
    }

    _chunk(text, offset=0) {
        var out = [];
        var a = text.match(/[\w'?!\.]+/g);
        a = a.splice(offset);
        while (a.length > 0) out.push(a.splice(0, this._size).join(" "));
        return out;
    }

    getRandomNode() {
        return this._nodes[Math.floor(Math.random()*this._nodes.length)];
    }

    getItem(key) {
        var item = localStorage.getItem(this._storage_namespace+key);
        if (!item) return {};
        return JSON.parse(item);
    }

    storeItem(key, val) {
        val = JSON.stringify(val);
        // Keep track of the size of our stored data.
        var k = this._storage_namespace+key;
        var item_size = (localStorage.getItem(k) || '').length;
        var size = parseInt(localStorage.getItem(
            this._storage_namespace+'__SIZE'
        ) || 0);
        // Save the new size.
        localStorage.setItem(
            this._storage_namespace+'__SIZE',
            size+val.length-item_size
        );
        localStorage.setItem(k, val);
    }

    integrate(text, offset=false) {
        var prev = false;
        var prev_word = false;
        if (offset === false) offset = this._size - 1; 
        for (let word of this._chunk(text, offset)) {
            // Ensure this node is in the database.
            if (!this._nodes.includes(word)) {
                this._nodes.push(word);
            }
            // Add to total of times this word has followed the previous.
            if (prev !== false) {
                prev[word] = prev[word] || 0;
                prev[word]++;
                this.storeItem(prev_word, prev);
            }
            prev_word = word;
            prev = this.getItem(word);
        }
        // We can increase the size of the corpus for larger
        // ngram sizes by shifting by the number of tokens.
        if (offset > 0) this.integrate(text, --offset);
    }

    getNodesFollowing(word) {
        var node = this.getItem(word);
        if (!node) return {};
        var total = 0,
            probs = {};
        for (let k in node) {
            total += node[k];
        }
        for (let k in node) {
            probs[k] = Math.floor(node[k]/total*100)/100;
        }
        return probs;
    }

    selectNextWord(word) {
        var node = this.getItem(word);
        if (node === undefined) return false;
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
            if (nums[i] >= n) return  
        }
    }

    getNode() {
        for (let node of this._nodes) return node;
    }

}
