require('update-electron-app')();
const fs = require('fs');
const dir1 = './config';
const dir2 ='./db'

if (!fs.existsSync(dir1)){
    fs.mkdirSync(dir1);
}

if (!fs.existsSync(dir2)){
  fs.mkdirSync(dir2);
}

if (require('electron-squirrel-startup')) return app.quit();

const axios = require('axios');
const { app, BrowserWindow, Menu, Tray, ipcMain } = require('electron');
const url = require('url');
const path = require('path');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const Bot = require('./bot.js');

const adaptertwtichConfig = new FileSync('./config/userconfig.json');
const twitchConfig = low(adaptertwtichConfig);

twitchConfig.defaults ({
  twitch:{
      username: '',
      password: '',
  },
  UI:[
    {
      title: 'default',
      theme: 'light' 
    }
  ] 
}).write();

class User{
  constructor(){
    this.username = twitchConfig.get('twitch').value().username;
    this.username = this.username.trim();

    this.password = twitchConfig.get('twitch').value().password;
    this.password = this.password.trim();
   
    const UISetting = twitchConfig.get('UI');

    if (UISetting.find({title: this.username}).value() === undefined){
      this.theme = UISetting.find({title: 'default'}).value().theme;
    } else {
      this.theme = UISetting.find({title: this.username}).value().theme;
    }

  }
}

const user = new User();

let tray = null;


const loginHtmlpath = url.format({
  pathname: path.join(__dirname, `/login.html`),
  protocol: "file:",
  slashes: true
});

const indexHtmlpath = url.format({
  pathname: path.join(__dirname, `/index.html`),
  protocol: "file:",
  slashes: true
});

let win;

const createWindow = () => {
  win = new BrowserWindow({
    width: 1200,
    height: 850,
    resizable: false,
    frame: false,
    center: true,
    // transparent: true,
    title: '200IQ Bot',
    // icon: './assets/fav_ico.ico',
    webPreferences: {
      nodeIntegration: true
    }
  })

  win.loadURL(loginHtmlpath);

  // win.removeMenu();

  win.on('minimize', function (event) {
      event.preventDefault();
      win.hide();
  });

  win.on('restore', function (event) {
      win.show();
  });
  
  tray = new Tray('./fav_ico.ico');
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open', click:  function(){
      win.show();
  } },
  { label: 'quit', click:  function(){
      win.closed = true;
      win.close();
  } }
  ])
  tray.setToolTip('200IQ Bot');
  tray.setContextMenu(contextMenu);
  tray.on('double-click', function (event) {
    win.show();
  });
  return win;
}

const createtwitchLoginWindow = () => {
  win = new BrowserWindow({
    width: 500,
    height: 900,
    resizable: false,
    center: true,
    title: '200IQ Bot',
    icon: 'fav_ico.ico',
    webPreferences: {
      webSecurity: false,
      nodeIntegration: true
    }
  })
  const twitchLoginURL = url.format({
    protocol: "https:",
    host: "id.twitch.tv",
    pathname: "oauth2/authorize",
    query: {
      response_type: "token",
      redirect_uri:  "http://localhost",
      scope: "channel:read:redemptions user:read:email chat:edit chat:read",
      client_id: "9vjnbv842m36gz321gcwvvwoui40l1",
      force_verify: true
    }
  });
  win.loadURL(twitchLoginURL);

  win.removeMenu();
  
  return win;
}

// let mainWindow = new createWindow();

const bot = new Bot(user.username, user.password);

let mainWindow = null;

app.on('ready', () => {

  

  ipcMain.handle('checkUserforLogin',  (event, args) => {
    let result = true;
    if (args['state']){
      mainWindow.loadURL(indexHtmlpath);
      return result;
    }
    if (((user.password == '') || (user.username == '')) || ((typeof user.password !== 'string') || (typeof user.username !== 'string'))){
      result = false;
    }
    return result;
  });

  mainWindow = createWindow();

  mainWindow.webContents.on('dom-ready', () => {
    mainWindow.webContents.send('UIInit', {
      username: user.username, 
      theme: user.theme, 
      commandsState: bot.config().commandsState, 
      iqState: bot.config().iqState
    })
  });
  
  mainWindow.on('closed', function(){
    app.quit();
  });

  ipcMain.handle('botConfig', async (e, args) => {
    let res = undefined;
    switch (args.action){
      case 'connect':
        res = await bot.start();
        
          return {res}
      case 'disconnect':
        res = await bot.stop();
        return {res}
      case 'functionState':
        bot.changeFunctionState(args.functionName, args.functionState);
        return res
      case 'getCommandsList':
        res = bot.getCommandsList();
        return res;
      case 'commandState':
        res = bot.setCommandState(args.commandName, args.commandState);
        return res;
      case 'addCommand':
        res = await bot.addCommand(args.commandName, args.commandDescription)
        return res;
      case 'removeCommand':
        res = bot.removeCommand(args.commandName);
        return res
      default:
      return Promise.reject('Неизвестная функция');
    }

  })

  ipcMain.on('UI', (e, args) =>{
    switch (args.action) {
      case 'close':
        mainWindow.hide();
      break;
    }
  });
  
  ipcMain.on('userConfig', (e, args) => {
    switch (args.action) {
      case 'switchTheme':
        const UIUserSettings = twitchConfig.get('UI').find({title: user.username});
        if (UIUserSettings.value() === undefined){
          twitchConfig.get('UI').push({
            title: user.username,
            theme: args.value
          }).write();
        } else {
          UIUserSettings.assign({theme: args.value}).write();
        }
        
      break;
    }
  });

});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('quit', () => {
  mainWindow.close();
  bot.stop();
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createWindow();
  }
});

ipcMain.on('twitchLogin', function() {
  let twitchLoginWindow = createtwitchLoginWindow();
  twitchLoginWindow.webContents.on('will-redirect', function (event, newUrl) {
    if (!(newUrl.startsWith("http://localhost"))){return}
 
   let oauthHash = newUrl.substr(1);
   let accessToken = oauthHash.substr(oauthHash.indexOf('access_token=')).split('&')[0].split('=')[1];
 
   twitchConfig.get('twitch').assign({
     password: accessToken
   }).write();
 
   axios.get('https://id.twitch.tv/oauth2/validate', {headers: {'Authorization': `OAuth ${accessToken}`}})
   .then((response) => {
     console.log(response);
     twitchConfig.get('twitch').assign({
       username: response.data['login']
     }).write();
     user.username = response.data['login'];
   }, (error) => {
     console.log(error);
   });
   mainWindow.loadURL(indexHtmlpath);
   twitchLoginWindow.close();
 
 });

  twitchLoginWindow.on('closed', function(){
    twitchLoginWindow = null;
  });

});



