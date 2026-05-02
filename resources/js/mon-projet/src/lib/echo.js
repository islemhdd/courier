import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { API_ORIGIN } from '../api/axios';
import api from '../api/axios';

window.Pusher = Pusher;

const echo = new Echo({
    broadcaster: 'reverb',
    key: import.meta.env.VITE_REVERB_APP_KEY,
    wsHost: import.meta.env.VITE_REVERB_HOST,
    wsPort: import.meta.env.VITE_REVERB_PORT,
    wssPort: import.meta.env.VITE_REVERB_PORT,
    forceTLS: (import.meta.env.VITE_REVERB_SCHEME ?? 'https') === 'https',
    enabledTransports: ['ws', 'wss'],
    authorizer: (channel, options) => {
        return {
            authorize: (socketId, callback) => {
                api.post('/broadcasting/auth', {
                    socket_id: socketId,
                    channel_name: channel.name
                })
                .then(response => {
                    console.log('Echo auth success for channel', channel.name);
                    callback(false, response.data);
                })
                .catch(error => {
                    console.error('Echo auth failed for channel', channel.name, error);
                    callback(true, error);
                });
            }
        };
    },
});

echo.connector.pusher.connection.bind('connected', () => {
    console.log('Echo successfully connected to Reverb!');
});

echo.connector.pusher.connection.bind('error', (err) => {
    console.error('Echo connection error:', err);
});

export default echo;
