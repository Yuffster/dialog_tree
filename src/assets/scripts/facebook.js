function Facebook() {

	FB.getLoginStatus(function(r) {
		if (r.status == 'connected') {
			window.feed = new Feed(r.authResponse.userID);
		} else {
			console.log("not logged in");
		}
	});

};

class Feed {

	constructor(id) {
		this.id = id;
		this._pending = 0;
		this._corpus = "";
		this.getFeed();
		this._max_pages = 1;
		this._markov = new Markov();
		this._pages = 0;
	}

	api(uri, fun) {
		FB.api(uri, (res) => {
			if (res.error) console.error(res.error);
			else fun(res);
		});
	}

	getFeed(page) {
		if (page) {
			this._pages++;
			if (this._max_pages < this._pages) return;
		}
		this.pending();
		this.api(page || 'me?fields=posts', (res)=>{
			this.done();
			var data = (page) ? res.data : res.posts.data;
			for (let post of data) {
				this.add_to_corpus(post.message);
				this.getComments(post.id);
			}
			var next = false;
			if (page && res.paging) {
				next = res.paging.next;
			} else if (res.posts && res.posts.paging) {
				next = res.posts.paging.next;
			}
			if (next) this.getFeed(next);
		});
	}

	getComments(id, after) {
		this.pending();
		var uri = id+'/comments';
		if (after) uri += '?after='+after;
		this.api(uri, (res)=> {
			this.done();
			var next = (res.paging) ?
				res.paging.cursors.after : false;
			if (next) this.getComments(id, next);
			for (let c of res.data) {
				if (c.from.id == this.id) {
					this.add_to_corpus(c.message);
				}
			}
		});
	}

	pending() {
		this._pending++;
	}

	done() {
		this._pending--;
		if (this._pending == 0) {
			//this.saveLocally();
		}
	}

	add_to_corpus(str) {
		if (!str) return;
		// Strip URLs.
		str = str.replace(/https?:\/\/([^ ]*)/g, '');
		this._markov.integrate(str);
	}

	get pages() {
		return this._pages;
	}

	get size() {
		return this._corpus.length / 4;
	}

	get corpus() {
		return this._corpus;
	}

	saveLocally() {
		//localStorage.setItem('corpus_FB', this._corpus);
	}

}