from flask_api import app
from flask import render_template, redirect, request, session

@app.route('/')
def index():
  return render_template('index.html')