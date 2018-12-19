from flask import Flask, request
from flask import Flask, render_template
from flask_cors import CORS
from flask_socketio import SocketIO, emit
# from flask_sockets import Sockets

from threading import Thread
import os
app = Flask(__name__, static_folder="./build/static", template_folder="./build")
CORS(app)

socketio = SocketIO(app)





@socketio.on('message', namespace='/')
def test_message(message):
    print('MESSAGE', message)
    emit('message_data', message, broadcast=True)


@socketio.on('connect', namespace='/')
def test_connect():
    print('connected')
    emit('my response', {'data': 'Connected'})

@socketio.on('disconnect', namespace='/test')
def test_disconnect():
    print('disconnected')
    print('Client disconnected')



@app.route('/', methods=['Get'])
def index():
  return render_template( 'index.html')

@app.route('/data', methods=['Get'])
def home():
    return  'data from the backend received'




if __name__ == '__main__':
    port = int(os.environ.get('PORT', 33507))
    # app.run(host='0.0.0.0', port=port, debug = os.environ.get('DEV'))
    socketio.run(app, host='0.0.0.0', port=port)
    # socketio.run(app, port = port)