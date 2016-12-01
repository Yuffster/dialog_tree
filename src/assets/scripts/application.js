function Application() {

class Template {
    constructor(templateID) {
        var template = document.getElementById(templateID);
        if (templateID && !template) {
            throw "Can't find template named "+templateID;
        }
        this._template = (template) ? template.innerHTML : "";
    }
    render() {
        this.beforeRender();
        var that = this;
        var patt = /{{\s?(.*?)\s?}}/g;  // {{ WORD }}
        var html = this._template.replace(patt, function(m, name) {
            return that[name];
        });
        if (this._container) {
            this._container.innerHTML = html;
        }
        this.afterRender();
        return html;
    }
    attach(id) {
        this._container = document.getElementById(id);
    }
    beforeRender() {}
    afterRender() {}
}

class ListTemplate extends Template {
    constructor(templateID, itemClass) {
        super(templateID);
        this._nodes = [];
        this._itemClass = itemClass || Template;
        if (!this._template) {
            this._template = "{{ nodes }}";
        }
    }
    addNode(node) {
        let obj = new this._itemClass();
        // Set node properties.
        if (node instanceof Object) for (let k in node) obj[k] = node[k];
        this._nodes.push(obj);
    }
    addNodes(nodes) {
        for (let n of nodes) this.addNode(n);
    }
    set nodes(data) {
        this._nodes = [];
        this.addNodes(data);
    }
    get nodes() {
        var html = "";
        for (let n of this._nodes) html += n.render();
        return html;
    }
}

class WordNode extends Template {
    constructor(words, prob, id) {
        super('word_node');
        this.words = words;
        this.prob = prob;
        this.id = id;
    }
}

class NodeList extends ListTemplate {
    constructor(nodes) {
        super('node_list', WordNode);
        if (nodes) {
            this.nodes = nodes;
        }
    }
}

class DialogTree extends ListTemplate {
    constructor(nodes) {
        super('dialog_tree', NodeList);
        if (nodes) {
            this._nodes = nodes;
        }
        this._words = [];
    }
    addWord(word, id) {
        this._words.push(word);
    }
    get words() {
        return this._words.join(" ");
    }
    beforeRender() {
        // Remember which nodes are active so we can switch them on again
        // after the re-render.
        this._selected_ids = [];
        if (!this._container) return;
        var selected = this._container.querySelectorAll(
            '.node-list li.selected'
        );
        for (let s of selected) this._selected_ids.push(s.id);
    }
    afterRender() {
        // Restore selected IDs.
        if (this._selected_ids) {
            for (let id of this._selected_ids) {
                let el = this._container.querySelector('#'+id);
                if (el) el.classList.add('selected');
            }
        }
        var max_len = 4;
        // Trim the nodes.
        var nodes = this._container.querySelectorAll(
            '.node-list'
        );
        if (nodes.length > max_len) {
            nodes = [].slice.call(nodes);
            for (let n of nodes.slice(0, nodes.length-max_len)) {
                n.remove();
            }
        }
    }
}

d = new DialogTree();

d.attach('test-ui');

d.render();

delegate('#markov-ui .node-list:last-child li', 'click', function(evt, target) {
    target.classList.add('selected');
    var words = target.dataset.words,
        id = target.id;
    addNode(words, id);
});

var txt = localStorage.getItem('corpus_FB')
//var m = new Markov();

//m.integrate(txt);
//m.integrate('we wanted to have fun we went to the mall we wanted to have fun')
//m.loadStorage();

var w = new WorkerAPI('markov_worker', "MRKV_");

var c = w.request('count', 5);
c.on('progress', function(v, i, t) { console.log(v, i, 'of', t); });
c.on('done', function(v) { console.log("last result", v); });
c.start();

var e = w.request('echo', 'hello, world');
e.on('progress', function(v, i, t) { console.log(v, i, 'of', t); });
e.on('done', function(v) { console.log("last result", v); });
e.start();

function addNode(word, id) {
    var data = m.getNodesFollowing(word);
    var nodes = [];
    for (let k in data) {
        let node = {};
        let esc = k.replace(/\W/g, '_');
        node.words = k;
        node.prob = data[k];
        node.id = esc+Math.floor(Math.random()*1000)+new Date().getTime();
        nodes.push(node);  
    }
    d.addWord(word, id);
    d.addNode({'nodes':nodes})
    d.render();
}

//addNode(m.getRandomNode())


};