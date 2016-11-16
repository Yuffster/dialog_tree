class Markov {

    constructor() {
        this._nodes = {};
    }

    integrate(text) {
        var prev = false;
        for (let word of text.split(" ")) {
            // Ensure this node is in the database.
            this._nodes[word] = this._nodes[word] || {};
            // Add to total of times this word has followed the previous.
            if (prev !== false) {
                prev[word] = prev[word] || 0;
                prev[word]++;
            }
            prev = this._nodes[word];
        }
    }

    getNodesFollowing(word) {
        if (this._nodes[word] === undefined) return {};
        var total = 0,
            probs = {};
        for (let k in this._nodes[word]) {
            total += this._nodes[word][k];
        }
        for (let k in this._nodes[word]) {
            probs[k] = Math.floor(this._nodes[word][k]/total*100)/100;
        }
        return probs;
    }

    selectNextWord(word) {
        var node = this._nodes[word];
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

}