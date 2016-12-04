function Application() {

var ui = false;  // UI.

delegate('#markov-ui div:last-child li', 'click', function(evt, target) {
    target.classList.add('selected');
    var words = target.dataset.words,
        id = target.id;
    ui.addNodeToTree(words, id);
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

class UI {

    constructor() {
        this._markov = new Markov();
        this._tree = this._makeTree();
        this._els = {
            'main': document.body,
            'log': document.getElementById('scroll-bg'),
            'samples': document.querySelectorAll('.background-nodelist'),
            'progress': document.getElementById('progress-meter'),
            'progress_text': document.getElementById('progress-text'),
            'transcript': document.getElementById("transcript-output")
        };
    }

    _makeTree() {
        var tree = new DialogTree();
        tree.attach('tab-markov');
        tree.render();
        return tree;
    }

    addNodeToTree(word) {
        if (!word) return;
        this.speak(word);  // For Diego.
        this._markov.getNodesFollowing(word, (data) => {
            if (!data) return;
            var nodes = [];
            for (let k in data) {
                if (k.trim() == "") continue;
                let node = {};
                let esc = k.replace(/\W/g, '_');
                node.words = k;
                node.prob = data[k];
                node.id = this.makeId();
                nodes.push(node);
            }
            this._tree.addWord(word, 345);
            this._tree.addNode({'nodes':nodes})
            this._tree.render();
        });
    }

    integrate(txt) {
        this._els.main.classList.add('loading');
        var progress = this._els.progress;
        var ptext = this._els.progress_text;
        this._markov.integrate(txt, {
            progress: (value, i, t) => {
                var p = Math.floor(i/t*100);
                if (progress) {
                    progress.style.width = p+'%';
                    ptext.innerHTML = p+'%';
                }
                this.addToLog(value);
            }, done: () => {
                document.body.classList.remove('loading');
            }
        });
    }

    addToLog(word) {
        var log = this._els['log'];
        if (!log) return;
        var p = document.createElement("span");
        p.innerHTML = word;
        log.append(p);
        // Append a break randomly.  It looks cool.
        if (Math.floor(Math.random()*12)==0) {
            log.append(document.createElement("p"));
        }
        // If we have enough backlog, just delete the oldest entry 
        // before adding a new one.
        if (log.scrollTop && log.scrollTop + 50 < log.scrollHeight) {
            log.firstChild.remove()
        }
        log.scrollTop = log.scrollHeight;
        this.addToSamples(word);
    }

    addToSamples(word) {
        var bgs = this._els['samples'];
        var bg = bgs[Math.floor(Math.random()*bgs.length)];
        let p = document.createElement('p');
        bg.append(p);
        p.innerHTML = word;
        // If we have enough backlog, just delete the oldest entry 
        // before adding a new one.  (Need to make this DRY.)
        if (bg.scrollTop && bg.scrollTop + 50 < bg.scrollHeight) {
            bg.firstChild.remove()
        }
        bg.scrollTop = bg.scrollHeight;
    }

    makeId() {
        return 'node'+Math.floor(Math.random()*1000)+new Date().getTime();
    }

    addCorpus(name) {
        /* Load one of the pre-defined corpora. */
        var req = new XMLHttpRequest();
        req.onreadystatechange = (data)=>{
            if (req.readyState != 4) return;
            this.integrate(req.responseText);
        };
        req.open('GET', '/assets/corpora/'+name+'.txt')
        req.send();
    }

    speak(txt) {
        if (!SpeechSynthesisUtterance) return;
        var msg = new SpeechSynthesisUtterance(txt);
        var voices = window.speechSynthesis.getVoices();
        msg.voiceURI = 'native';
        msg.volume = 1; // 0 to 1
        msg.rate = 1; // 0.1 to 10
        speechSynthesis.speak(msg);
    }

    newTree(start_node) {
        /**
         * Create a new tree, add this node.
         **/
        this._tree = this._makeTree();
        this.addNodeToTree(start_node);
    }

    startTree() {
        this._markov.getRandomNode((n) => this.newTree(n));
    }

    clearCorpus() {
        this._markov.clearCorpus();
    }

    integrateSpeech() {
        if (!webkitSpeechRecognition) return false;
        var recognition = new webkitSpeechRecognition();
        recognition.interimResults = true;
        recognition.onresult = (event) => {
            var transcript = event.results[0][0].transcript;
            this._els.transcript.innerHTML = transcript;
            if (event.results[0].isFinal) {
                this._els.main.classList.remove('recording');
                this.integrate(transcript);
            }
        }
        this._els.main.classList.add('recording');
        recognition.start();
    }

}

ui = new UI();
window.ui = ui;

ui.startTree();


};