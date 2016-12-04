function Application() {

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
    if (!word) return;
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

if (1) {
    var req = new XMLHttpRequest();
    req.onreadystatechange = function (data) {
        if (req.readyState != 4) return;
        integrate(req.responseText);
    };
    req.open('GET', '/assets/corpora/chamber_secrets.txt')
    req.send();
}



m.getRandomNode(addNode);

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