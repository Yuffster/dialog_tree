class Template {
    constructor(templateID) {
        var template = document.getElementById(templateID);
        if (templateID && !template) {
            throw "Can't find template named "+templateID;
        }
        this._template = (template) ? template.innerHTML : "";
    }
    render() {
        var that = this;
        var patt = /{{\s?(.*?)\s?}}/g;  // {{ WORD }}
        var html = this._template.replace(patt, function(m, name) {
            return that[name];
        });
        if (this._container) {
            this._container.innerHTML = html;
        }
        return html;
    }
    attach(id) {
        this._container = document.getElementById(id);
    }
}

class ListTemplate extends Template {
    constructor(templateID, itemClass) {
        super(templateID);
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
            this.nodes = nodes;
        }
    }
}

var stub_data = [
    {
        nodes: [
            {
                'words': 'never gonna',
                'prob': 1,
                'id': 23425
            },
            {
                'words': 'strangers',
                'prob': 1,
                'id': 234
            }
        ]
    },
    {
        nodes: [
            {
                'words': 'let you down',
                'prob': 1,
                'id': 225
            },
            {
                'words': 'say goodbye',
                'prob': 1,
                'id': 25
            },
            {
                'words': 'hurt you',
                'prob': 1,
                'id': 235
            },
            {
                'words': 'run around',
                'prob': 1,
                'id': 2325
            },
            {
                'words': 'desert you',
                'prob': 1,
                'id': 237
            }
        ]
    }
];

d = new DialogTree(stub_data);
d.attach('test-ui');

d.addNode({nodes:[{
        'words': 'hurt you',
        'prob': 1,
        'id': 2435
    },
    {
        'words': 'desert you',
        'prob': 1,
        'id': 2937
    }
]});

d.render()