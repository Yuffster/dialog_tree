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
            'transcript': document.getElementById("transcript-output"),
            'output': document.getElementById('output')
        };
        this._loading_things = 0;
        this._total_loading = 0;
        this._total_loaded = 0;
        this._progress = new ProgressUI(
            this._els.progress,
            this._els.progress_text
        );
    }

    _makeTree() {
        var tree = new DialogTree();
        tree.attach('tree-ui');
        tree.render();
        return tree;
    }

    smush(txt) {
        if (!txt) return txt;
        return txt.replace(/(\s+)[.?,!]/g, function(w) { 
            return w.trim();
        });
    }

    addNodeToTree(word) {
        if (!word) return;
        this.speak(word);  // For Diego.
        this._els.output.innerHTML += ' '+word;
        this._els.output.innerHTML = this.smush(this._els.output.innerHTML);
        this._markov.getNodesFollowing(word, (data) => {
            var nodes = [];
            for (let k in data) {
                if (k.trim() == "") continue;
                let node = {};
                node.words = k;
                node.prob = data[k];
                node.id = this.makeId();
                nodes.push(node);
            }
            this._tree.addNode({'nodes':nodes})
            this._tree.render();
        });
    }

    integrate(txt) {
        this._els.main.classList.add('loading');
        var progress = this._progress.addThread({
            progress: (v) => this.addToLog(v)
        });
        this._markov.integrate(txt, progress);
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
        msg.volume = 1;
        msg.rate = 1;
        speechSynthesis.speak(msg);
    }

    newTree(start_node) {
        /**
         * Create a new tree, add this node.
         */
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

class ProgressUI {

    constructor(meter, ptext) {
        this._els = {};
        this._els.meter = meter;
        this._els.text = ptext;
        this._els.main = document.body;
        this._waiting = 0;
        this._total = 0;
    }

    addThread(funs) {
        this._els.main.classList.add('loading');
        var remaining;
        funs = funs || {};
        return {
            start: (total) => {
                remaining = total;
                this._waiting += total;
                this._total += total;
                this.update();
                if (funs.start) funs.start(total);
            },
            progress: (...args) => {
                remaining--;
                this._waiting--;
                this.update();
                if (funs.progress) funs.progress.apply(null, args);
            },
            done: (...args) => {
                this._waiting -= remaining;
                this.update();
                if (funs.done) funs.done.apply(null, args);
            }
        };
    }

    update() {
        var meter = this._els.meter;
        var text = this._els.text;
        var p;
        if (this._waiting <= 0) p = 100;
        else {
            p = Math.floor((this._total-this._waiting)/this._total*100);
        }
        meter.style.width = p+'%';
        text.innerHTML = p+'%';
        if (p==100){
            document.body.classList.remove('loading');
        } else {
            document.body.classList.add('loading');
        }
    }

}

ui = new UI();
window.ui = ui;

ui.startTree();


};