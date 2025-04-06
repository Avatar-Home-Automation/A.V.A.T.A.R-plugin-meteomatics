import axios from 'axios';
import * as url from 'url';
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

//language pak
let Locale;

const weatherSymbol = [
	"A weather symbol could not be determined", 
	"Clear sky",
	"Light clouds",
	"Partly cloudy",
	"Cloudy",
	"Rain",
	"Rain and snow / sleet",
	"Snow",
	"Rain shower",
	"Snow shower",
	"Sleet shower",
	"Light Fog",
	"Dense fog",
	"Freezing rain",
	"Thunderstorms",
	"Drizzle",
	"Sandstorm"
];

/**
 * Plugin initialization
 * This function is executed upon loading the plugin
 */
export async function init() {
    if (!await Avatar.lang.addPluginPak("meteomatics")) {
        return error('meteomatics: unable to load language pak files');
    }
}


export async function action(data, callback) {

	try {
		Locale = await Avatar.lang.getPak("meteomatics", data.language);
        if (!Locale) {
            throw new Error (`meteomatics: Unable to find the '${data.language}' language pak.`);
        }

		// Table of actions
		const tblActions = {
			getWeather : () => getWeather(data.client, data.action?.byScenario, callback)					
		}
		
		// Writes info console
		info("meteomatics:", data.action.command, L.get("plugin.from"), data.client);
			
		// Calls the function that should be run
		tblActions[data.action.command]();
	} catch (err) {
		if (data.client) Avatar.Speech.end(data.client);
		if (err.message) error(err.message);
	}	
		
	// Returns callback only by a rule
	// It's the callback of the speak that sends the callback if it's executing by a scenario
	if (!data.action?.byScenario) callback();
 
}


async function getCityCoordinates() {

	return new Promise((resolve, reject) => {

		const city = Config.modules.meteomatics?.city;
		if (!city) {
			warn(Locale.get('error.configCity'));
			reject();
		}

		const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json`;

		axios.get(url)
		.then(async response => {
			if(response.data.length > 0) {
				resolve (response.data[0]);
			} else {
				warn(Locale.get('error.noCoord', city));
				reject ();
			}
		})
		.catch(err => {
			error ('Error meteomatics:', err.stack ||  err);
			reject();
		});
	})
}


function createWeatherSentence(city, weatherData) {
	const temperature = weatherData.find(item => item.parameter === "t_2m:C")?.value;
	const weatherIdx = weatherData.find(item => item.parameter === "weather_symbol_1h:idx")?.value;
	const weatherCondition = weatherSymbol[weatherIdx];
	const translatedWeather = Locale.get(`message["${weatherCondition}"]`) || weatherCondition;
	const tts = Locale.get('message.tts', city, temperature, translatedWeather);
	return tts;
}


async function getWeather(client, byScenario, callback) {

	const username = Config.modules.meteomatics.username;
	const password = Config.modules.meteomatics.password;

	if (!username || !password ) {
		warn(Locale.get("error.noIdentification"));
		Avatar.Speech.end(data.client);
		if (byScenario) callback();
		return;
	}

	let coordonates;
	try {
		coordonates = await getCityCoordinates();
	} catch (err) {
		Avatar.Speech.end(data.client);
		if (byScenario) callback();
		return;
	}

	const city = Config.modules.meteomatics?.city;
	const date = new Date().toISOString();
	const url = `https://api.meteomatics.com/${date}/t_2m:C,weather_symbol_1h:idx/${coordonates.lat},${coordonates.lon}/json`;

	axios.get(url, {
		auth: {
		  username: username,
		  password: password
		}
	  })
	  .then(response => {
		const results = response.data.data.map(item => ({
			parameter: item.parameter,
			value: item.coordinates[0].dates[0].value
		}));
		
		const sentence = createWeatherSentence(city, results);

		Avatar.speak(sentence, client, () => {
			if (byScenario) callback();
		});
	  })
	  .catch(err => {
		error(Locale.get("error.meteo"), err);
		Avatar.Speech.end(data.client);
		if (byScenario) callback();
	  });
}





