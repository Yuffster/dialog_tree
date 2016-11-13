function Application() {

var delegates = {};

function delegate(selector, event, fun) {

    if (!delegates[event]) {
        // Add a global event delegator for this action.
        document.body.addEventListener(event, function(evt) {
            // Check all the selectors for this item.
            for (let selector in delegates[event]) {
                // Bubble up the DOM tree in case the target is within a
                // delegated selector.
                (function bubble(el) {
                    if (el.matches(selector)) {
                        var funs = delegates.click[selector];
                        for (fun of funs) fun(evt, el);
                    }
                    // Recursion until we hit the root node.
                    var parent = el.parentNode;
                    if (parent && parent.matches) bubble(parent);
                }(evt.target))
            }
        });
        // Add this to our delegation object.
        delegates[event] = {};
    }

    // Ensure a callback list exists for this selector.
    if (!delegates[event][selector]) delegates[event][selector] = [];

    // Add this function to the list of selectors.
    delegates[event][selector].push(fun);

}

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
                'words': 'never',
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
                'words': 'let',
                'prob': 1,
                'id': 225
            },
            {
                'words': 'say',
                'prob': 1,
                'id': 25
            },
            {
                'words': 'hurt',
                'prob': 1,
                'id': 235
            },
            {
                'words': 'run',
                'prob': 1,
                'id': 2325
            },
            {
                'words': 'desert',
                'prob': 1,
                'id': 237
            }
        ]
    }
];

d = new DialogTree(stub_data);
d.attach('test-ui');

d.addNode({nodes:[{
        'words': 'hurt',
        'prob': 1,
        'id': 2435
    },
    {
        'words': 'desert',
        'prob': 1,
        'id': 2937
    }
]});

d.render();

delegate('#markov-ui .node-list li', 'click', function(evt, target) {
    target.classList.add('selected');
});

socket = io.connect('//' + document.domain + ':' + location.port);

socket.on('connect', function() {
    socket.emit('select_node', 13);
});

socket.on('add_node', function(data) {
    d.addNode(data);
    d.render();
});

};