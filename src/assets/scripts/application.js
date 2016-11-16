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
        this.render();
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
        if (this._selected_ids) {
            for (let id of this._selected_ids) {
                let el = this._container.querySelector('#'+id);
                if (el) el.classList.add('selected');
            }
        }
        var currents = document.querySelectorAll(
            '#markov-ui .node-list.current'
        );
        for (let el of currents) {
            el.classList.remove('current');
        }
        var last = document.querySelector('#markov-ui .node-list:last-child');
        if (last) last.classList.add('current');
    }
}

d = new DialogTree();

d.attach('test-ui');

d.render();

delegate('#markov-ui .node-list.current li', 'click', function(evt, target) {
    target.classList.add('selected');
    var words = target.dataset.words;
    addNode(words);
});

var m = new Markov();
// Hit new single - We Wanted to Have Fun.
m.integrate('we wanted to have fun we wanted to have fun we went to the mall we wanted to have fun we went to lunch we wanted to have fun we wanted to have fun we went to the beach we wanted to have fun we wanted to have fun');

function addNode(word) {
    var data = m.getNodesFollowing(word);
    var nodes = [];
    for (let k in data) {
        let node = {};
        node.words = k;
        node.prob = data[k];
        node.id = k+Math.floor(Math.random()*1000)+new Date().getTime();
        nodes.push(node);  
    }
    d.addNode({'nodes':nodes})
    d.render();
}

addNode("we");

};