import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import api from '../api/api';

window.Pusher = Pusher;

// In dev we default to enabled when the Reverb vars are set, only disabling when VITE_REVERB_ENABLED=false.
const reverbEnabled = import.meta.env.VITE_REVERB_ENABLED !== 'false'
const reverbKey = import.meta.env.VITE_REVERB_APP_KEY
const reverbHost = import.meta.env.VITE_REVERB_HOST
const reverbPort = import.meta.env.VITE_REVERB_PORT

const echoDisabledStub = {
  private() {
    return { notification() {}, stopListening() {} }
  },
  leave() {},
}

let echo = echoDisabledStub

if (reverbEnabled && reverbKey && reverbHost && reverbPort) {
  echo = new Echo({
    broadcaster: 'reverb',
    key: reverbKey,
    wsHost: reverbHost,
    wsPort: reverbPort,
    wssPort: reverbPort,
    forceTLS: (import.meta.env.VITE_REVERB_SCHEME ?? 'https') === 'https',
    enabledTransports: ['ws', 'wss'],
    authorizer: (channel) => {
      return {
        authorize: (socketId, callback) => {
          api
            .post('/broadcasting/auth', {
              socket_id: socketId,
              channel_name: channel.name,
            })
            .then((response) => {
              console.log('Echo auth success for channel', channel.name)
              callback(false, response.data)
            })
            .catch((error) => {
              console.error('Echo auth failed for channel', channel.name, error)
              callback(true, error)
            })
        },
      }
    },
  })

  echo.connector?.pusher?.connection?.bind('connected', () => {
    console.log('Echo successfully connected to Reverb!')
  })

  echo.connector?.pusher?.connection?.bind('error', (err) => {
    console.error('Echo connection error:', err)
  })
} else if (reverbEnabled) {
  console.info(
    'Echo disabled: missing VITE_REVERB_APP_KEY / VITE_REVERB_HOST / VITE_REVERB_PORT. Set VITE_REVERB_ENABLED=false to silence.',
  )
}

export default echo
