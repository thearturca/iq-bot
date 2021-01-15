require('update-electron-app')();
const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, Menu, Tray, ipcMain } = require('electron');
const keytar = require('keytar')

const appName = '200iqbot';
if (!fs.existsSync(path.join(app.getPath('documents'), appName))){
  fs.mkdirSync(path.join(app.getPath('documents'), appName));
}

const dirConfig = path.join(app.getPath('documents'), appName,'config');
const dirDB = path.join(app.getPath('documents'), appName, 'db');

if (!fs.existsSync(dirConfig)){
    fs.mkdirSync(dirConfig);
}

if (!fs.existsSync(dirDB)){
  fs.mkdirSync(dirDB);
}

const axios = require('axios');

if (require('electron-squirrel-startup')) return app.quit();

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {

const url = require('url');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const Bot = require('./bot.js');

const adaptertwtichConfig = new FileSync(path.join(dirConfig,'userconfig.json'));
const twitchConfig = low(adaptertwtichConfig);

twitchConfig.defaults ({
  twitch:
    {
      username: '',
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
    if(this.username == ''){
      this.password = '';
    }else{
      keytar.getPassword(appName, this.username).then((res)=>{
        this.password = res;
        console.log(this.password) 
      });
       
    }
    
   
    const UISetting = twitchConfig.get('UI');

    if (UISetting.find({title: this.username}).value() === undefined){
      this.theme = UISetting.find({title: 'default'}).value().theme;
    } else {
      this.theme = UISetting.find({title: this.username}).value().theme;
    }

  }
}


const logout = () =>{
  return new Promise((resolve, reject) =>{
    try{
      bot.stop();
      bot = null;
      user = null;
      twitchConfig.get('twitch').assign({username: ''}).write();
      user = new User;
      mainWin.loadURL(loginHtmlpath);
      resolve(true);
    }catch(err){
      reject(err)
    }
    

  })
}

let user;
let bot;

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

let mainWin;
let twitchLoginWin;
let tray = null;
const iconPath = path.join(__dirname, 'resources', 'fav_ico.ico');

const createMainWin = () => {
  mainWin = new BrowserWindow({
    width: 1200,
    height: 850,
    resizable: false,
    frame: false,
    center: true,
    // transparent: true,
    title: '200IQ Bot',
    // icon: iconPath,
    webPreferences: {
      nodeIntegration: true
    }
  })

    mainWin.loadURL(loginHtmlpath);
  
  mainWin.removeMenu();

  mainWin.on('minimize', function (event) {
      event.preventDefault();
      mainWin.hide();
  });

  mainWin.on('restore', function (event) {
    mainWin.show();
  });

  // mainWin.on('close', (e) =>{
  //   e.preventDefault();
  //   mainWin.show();
  // });

  mainWin.on('closed', function(){
    app.quit();
  });
 
  tray = new Tray(iconPath);
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open', click:  function(){
      mainWin.show();
  } },
  { label: 'Quit', click:  function(){
    mainWin.closed = true;
    app.quit();
  } }
  ])
  tray.setToolTip('200IQ Bot');
  tray.setContextMenu(contextMenu);
  tray.on('double-click', function (event) {
    mainWin.show();
  });
}

const createTwitchLoginWin = () => {
  twitchLoginWin = new BrowserWindow({
    width: 500,
    height: 900,
    resizable: false,
    center: true,
    title: '200IQ Bot',
    // icon: iconPath,
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
  twitchLoginWin.loadURL(twitchLoginURL);
  twitchLoginWin.removeMenu();
}

app.on('ready', () => {
  createMainWin();
  user = new User;
  bot = new Bot(user.username, user.password);
  ipcMain.handle('checkUserforLogin',  (event, args) => {
    let result = true;
    if (args['state']){
      mainWin.loadURL(indexHtmlpath);
      
      return result;
    }
    if (((user.password == '') || (user.username == '')) || ((typeof user.password !== 'string') || (typeof user.username !== 'string'))){
      result = false;
    }
    return result;
  });

    ipcMain.handle('UIInit', (e, args)=>{
      result = {username: user.username, 
      theme: user.theme, 
      commandsState: bot.config().commandsState, 
      iqState: bot.config().iqState
      };
      return result;
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
      case 'logout':
        res = await logout();
        return res;
      default:
      return Promise.reject('Неизвестная функция');
    }

  })

  ipcMain.on('UI', (e, args) =>{
    switch (args.action) {
      case 'close':
        mainWin.hide();
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
  mainWin.close();
  bot.stop();
})

app.on('second-instance', (event, commandLine, workingDirectory) => {
  // Someone tried to run a second instance, we should focus our window.
  if (mainWin) {
    if (mainWin.isMinimized()) mainWin.restore()
    mainWin.focus()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWin = createWindow();
  }
});

ipcMain.on('twitchLogin', function() {
  createTwitchLoginWin();
  twitchLoginWin.webContents.on('will-redirect', function (event, newUrl) {
    if (!(newUrl.startsWith("http://localhost"))){return}
 
   let oauthHash = newUrl.substr(1);
   let accessToken = oauthHash.substr(oauthHash.indexOf('access_token=')).split('&')[0].split('=')[1];
   user.password = accessToken;
 
   axios.get('https://id.twitch.tv/oauth2/validate', {headers: {'Authorization': `OAuth ${accessToken}`}})
   .then((response) => {
     twitchConfig.get('twitch').assign({
       username: response.data['login']
     }).write();
     user.username = response.data['login'];
     user.password = accessToken;
     keytar.setPassword(appName, user.username, accessToken)
     bot = new Bot(user.username, user.password);
     mainWin.loadURL(indexHtmlpath);
     twitchLoginWin.close();
   }, (error) => {
     console.log(error);
   });
  
 
 });

 twitchLoginWin.on('closed', function(){
  twitchLoginWin = null;
  });

});


}
