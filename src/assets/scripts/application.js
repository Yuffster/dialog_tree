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
        // Trim the nodes if we're showing too many.
        var nodes = this._container.querySelectorAll('.node-list');
        if (nodes.length == 0) return;
        var max_width  = this._container.scrollWidth * .8;
        var node_width = nodes[0].offsetWidth;
        var max_cols = Math.floor(max_width/node_width);
        if (nodes.length > max_cols) {
            nodes = [].slice.call(nodes);
            for (let n of nodes.slice(0, nodes.length-max_cols)) {
                n.remove();
            }
        }
    }
}

d = new DialogTree();

d.attach('tab-markov');

d.render();

delegate('#markov-ui div:last-child li', 'click', function(evt, target) {
    target.classList.add('selected');
    var words = target.dataset.words,
        id = target.id;
    addNode(words, id);
});

delegate('#tab-select a', 'click', function(evt, target) {
    var tabs = document.getElementById('tabs');
    var par = document.getElementById('tab-select');
    var name = target.href.replace(/^.*#/, '');
    var t = document.getElementById('tab-'+name);
    if (t) {
        // Set the link to active.
        let as = par.querySelectorAll('a.active');
        for (let n of as) n.classList.remove('active');
        // Set the active tab.
        let active = tabs.querySelectorAll('.tab.active');
        for (let n of active) n.classList.remove('active');
        t.classList.add('active');
    }
    target.classList.add('active');
});

function addNode(word) {
    speak(word);  // For Diego.
    m.getNodesFollowing(word, (data) => {
        if (!data) return;
        var nodes = [];
        for (let k in data) {
            if (k.trim() == "") continue;
            let node = {};
            let esc = k.replace(/\W/g, '_');
            node.words = k;
            node.prob = data[k];
            node.id = esc+Math.floor(Math.random()*1000)+new Date().getTime();
            nodes.push(node);  
        }
        d.addWord(word, 345);
        d.addNode({'nodes':nodes})
        d.render();
    });
}

var progress = document.getElementById('progress-meter');
var ptext = document.getElementById('progress-text');
var m = new Markov();
var test = localStorage.getItem('corpus_FB')
var lastWord = false;


let bg1 = document.getElementById('corpus-container');
let bg2 = document.getElementById('secondary-container');
let bg3 = document.getElementById('overflow-container');


var last_p = -1;
var last_value = "";

if (0) {
    var req = new XMLHttpRequest();
    req.onreadystatechange = function (data) {
        if (req.readyState != 4) return;
        integrate(req.responseText);
    };
    req.open('GET', '/assets/corpora/chamber_secrets.txt')
    req.send();
}



m.getRandomNode(addNode);

integrate('have fun we wanted to have fun we went to the mall')

function integrate(txt) {
    m.integrate(txt, {
        progress: (value, i, t) => {
            bg2.append(value+" ");
            if (Math.floor(Math.random()*12)==0) {
                bg2.append(document.createElement("br"));
            }
            bg2.scrollTop = bg2.scrollHeight;
            var p = Math.floor(i/t*100);
            if (lastWord) lastWord.innerHTML = value;
            if (progress) {
                progress.style.width = p+'%';
                ptext.innerHTML = p+'%';
            }
            if (p == 100) {
                document.body.classList.remove('loading');
            }
            last_value = value;
        }
    });
}

function speak(txt) {
    var msg = new SpeechSynthesisUtterance(txt);
    var voices = window.speechSynthesis.getVoices();
    msg.voiceURI = 'native';
    msg.volume = 1; // 0 to 1
    msg.rate = 1; // 0.1 to 10

    speechSynthesis.speak(msg);
}
window.speak = speak;

if (1) {
    let last = false;
    setInterval(() => {
        if (last_value && last_value != last) {
            last = last_value;
        } else return;
        var bgs = document.querySelectorAll('.background-nodelist');
        var bg = bgs[Math.floor(Math.random()*bgs.length)];
        let p = document.createElement('p');
        bg.append(p);
        p.innerHTML = last;
        bg.scrollTop = bg.scrollHeight;
    }, 100);
}

};