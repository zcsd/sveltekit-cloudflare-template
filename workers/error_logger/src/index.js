export default {
	async queue(batch, env) {
		for (const message of batch.messages) {
			let file = "";
			let day = "";
			let file_name = "";
			const { domain, place, error, user, timestamp } = message.body;
			const datetime = new Date(timestamp);
			day = get_day(datetime); // 'YYYY-MM-DD' in UTC
			file_name = `${domain}/${day}/${place}_${timestamp}_${user}.log`; // 'domain/YYYY-MM-DD/place_timestamp_user.log'
			file += user + "\n";
			file += timestamp + "\n";
			file += domain + "\n";
			file += place + "\n";
			file += error;
			await env.ERROR_BUCKET.put(file_name, file);
		}
	},
};

function full_time_str(t) {
	// add a leading zero to single digit numbers
	let t_str =  t.toString();
	if (t_str.length == 1) {
		t_str = '0' + t_str;
	}
	return t_str;
}

function get_day(dt) {
	// return a string in the format 'YYYY-MM-DD' for the given date
	const year_str = dt.getUTCFullYear().toString();
	const month_str = full_time_str(dt.getUTCMonth() + 1);
	const day_str =  full_time_str(dt.getUTCDate());

	return year_str + '-' + month_str + '-' + day_str;
}
