const { join } = require('path'),
	EventEmitter = require('events'),
	rss = require('rss-parser'),
	parser = new rss();

if (typeof (localStorage) == 'undefined' || typeof (localStorage) == 'null') {
	var LocalStorage = require('node-localstorage').LocalStorage;
	localStorage = new LocalStorage(join(__dirname, 'storage'));
}

class Notifier extends EventEmitter {
	constructor(options = {
		channels: [],
		checkInterval: 50
	}) {
		super();
		if (!options.checkInterval) options.checkInterval = 50;

		if (!Array.isArray(options.channels)) throw new Error('Channels must be an array');

		this.ids = options.channels;
		this.add = (channels) => {
			channels.forEach(id => {
				parser.parseURL(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`)
					.then(response => {
						let videoid = response.items[0].id.replace('yt:video:', '');
						localStorage.setItem(videoid, videoid);
					}).catch(err => {
						if (err.message == 'Status code 404') return console.warn(`Channel not found. Channel ID: ${id}`);
						console.warn(err);
					});
			});
		}
		this.add(options.channels);
		if (typeof (options.checkInterval) != 'number') {
			throw new Error('Check interval must be a number');
		} else if (options.checkInterval < 30) {
			console.warn('Check interval is too short. Short intervals can cause problems.');
		};

		setInterval(() => {
			this.ids.forEach(id => {
				parser.parseURL(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`)
					.then(response => {
						let item = response.items[0];
						const video = {}
						video.channelName = item.author;
						video.title = item.title;
						video.publishDate = `${item.pubDate.split('T')[0]} ${item.pubDate.split('T')[1].replace('.000Z', '')}`;
						video.url = item.link;
						video.id = item.id.replace('yt:video:', '');
						if (localStorage.getItem(video.id)) return;
						localStorage.setItem(video.id, video.id);
						this.emit('video', video);
					})
					.catch(err => {
						if (err.message == 'Status code 404') return console.warn(`Channel not found. Channel ID: ${id}`);
						console.warn(err);
					});

			});
		}, options.checkInterval * 1000);
	}
	addChannels(channels) {
		return new Promise((resolve, reject) => {
			if (!Array.isArray(channels)) return reject('Channels must be an array');
			if (channels.length == 0) return reject('Please provide channel IDs');
			var result = [],
				i = 0,
				check = (data) => {
					result.push(data);
					i++;
					if (channels.length == i) resolve(result);
				};
			channels.forEach(channel => {
				parser.parseURL(`https://www.youtube.com/feeds/videos.xml?channel_id=${channel}`).then(response => {
					this.ids.push(channel);
					let videoid = response.items[0].id.replace('yt:video:', '');
					localStorage.setItem(videoid, videoid);
					check({ result: true, channelID: channel });
				}).catch(err => {
					if (err.message == 'Status code 404') {
						check({ result: 'Channel not found.', channelID: channel });;
					} else {
						check({ result: err, channelID: channel });
					}
				})
			});
		});
	}

	removeChannels(channels) {
		return new Promise((resolve, reject) => {
			if (!Array.isArray(channels)) return reject('Channels must be an array');
			if (channels.length == 0) return reject('Please provide channel IDs');
			var result = [],
				i = 0,
				check = (data) => {
					result.push(data);
					i++;
					if (channels.length == i) resolve(result);
				};

			channels.forEach(channel => {
				if (!this.ids.some(url => url == channel)) {
					check({ result: 'Unknown channel', channelID: channel });
				}
				for (let i = 0; i < this.ids.length; i++) {
					if (!this.ids[i] == channel) return;
					this.ids.splice(i, 1);
					check({ result: true, channelID: channel });
				}
			})
		})
	}
}

module.exports = Notifier;
