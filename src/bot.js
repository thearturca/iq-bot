const tmi = require ('tmi.js');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const _ = require('lodash');
const path = require('path');
const { app } = require('electron');
const { log } = require('console');

const dirConfig = path.join(app.getPath('documents'), '200iqbot', 'config');
const dirDB = path.join(app.getPath('documents'), '200iqbot', 'db');

const adapterBotConfig = new FileSync(path.join(dirConfig, 'botconfig.json'));
const botConfig = low(adapterBotConfig);

botConfig.defaults ({
    botConfig:[
        {
            title: 'default',
            target: 'default',
            iqState: false,
            commandsState: false,
            soundCommandsState: true
        },
    ],
    iqConfig:[
        {
            title: 'default',
            MaxTry: 3,
            CDtime: 6,
            iqMin:70,
            iqMax:140,
            iqMinCoeff: 1,
            iqMaxCoeff: 1,
            VIPCoeff: 20,
            subCoeff: 1
        },
    ]
}).write();

class IqTest {
    
    constructor (target){
        this._target = target;
        const adapterIQ = new FileSync(path.join(dirDB,`iq-db-${this._target}.json`));
        this._iqDB = low(adapterIQ);
        this._iqDB.defaults({ 
            users: []
        }).write();
        
        this.initConfig();
    }

    initConfig(){
        let config = botConfig.get('iqConfig');
        if(config.find({title: this._target}).value() === undefined){
            const defaultConfig = config.find({title: 'default'}).value();
            const newConfig = Object.assign({}, defaultConfig);
            newConfig.title = this._target;
            config.push(newConfig).write();
        }
        this._config = config.find({title: this._target}).value();
        return this._config;
    }

    updateConfig(){
        botConfig.get('iqConfig').find({title: this._target}).assign(this._config).write();
        return this._config;
    }

    config(){
        return this._config;
    }

    rollIq(user){
        const getBaseLog = (y, x)=>{
            return Math.log(y) / Math.log(x);
        }

        const randomG = (v=3) =>{ 
            var r = 0;
            for(var i = v; i > 0; i --){
                r += Math.random();
            }
            return r / v;
        }

        const curTime = Date.now();
        const tryNmax = this._config.MaxTry;
        const users = this._iqDB.get('users');
        const usernameDB = users.find({username: user["display-name"].toLowerCase()});
        const iqCDtime = this._config.CDtime * 1000 * 60 * 60; //hrs * millisec * sec * min
    
        const iq_rng = (user) => {
            const { badges, 'badge-info': badgeInfo } = user;
            let isSubscriber = false;
            let isVIP = false;
            const isMod = user["mod"];
            
            let monthsSubbed = 0;
    
            if(badges) {
                isSubscriber = badges.subscriber || badges.founder;
                isVIP = badges.vip || badges.founder;
                if(isSubscriber) {
                    monthsSubbed = badgeInfo.subscriber || badgeInfo.founder;
                    monthsSubbed = Number(monthsSubbed);
                }
            }

            monthsSubbed = 2 + Math.floor(randomG() * (24+monthsSubbed));
    
            let VIPCoeff = 0;
            if (isVIP){
                VIPCoeff = Math.floor(randomG() * this._config.VIPCoeff);
            }
    
            let modCoeff = 0;
            if (isMod){
                modCoeff = Math.floor(randomG() * this._config.VIPCoeff);
            }
    
            const monthsCoeff = getBaseLog(monthsSubbed, 12);
            const iq_min = Math.floor(this._config.iqMin * monthsCoeff + VIPCoeff + modCoeff);
            const iq_max = Math.floor(this._config.iqMax * monthsCoeff + VIPCoeff + modCoeff) - iq_min;
            const iq = iq_min + Math.floor(randomG() * iq_max);
            return iq;
        }
    
        if (usernameDB.value() === undefined){
            const iq = iq_rng(user);
            users.push({
    
                username: user["display-name"].toLowerCase(),
                iq: iq,
                try: 1,
                lastDate: Date.now(),
                count: 1,
                userdisplayname: user["display-name"]
        
            }).write();
            let resSTR = `@${user["display-name"]} уровень вашего IQ равен ${iq}.`;
            if ((tryNmax - 1) === 0) { resSTR += ` На сегодня это все, для следующего теста приходите завтра. Хорошего дня karmikSmile` } else {resSTR += ` Осталось попыток - ${(tryNmax - 1)}.`}
            return resSTR;
        }
        else {
            let tryNumberDB = usernameDB.value().try;
            let lastDateDB = usernameDB.value().lastDate;
            if (tryNumberDB === -1 || tryNmax === 0){
                const iq = iq_rng(user);
                usernameDB.assign({
    
                    iq: iq, 
                    try: -1,
                    lastDate: Date.now(),
                    count: usernameDB.value().count+1
                    
    
                }).write();
                let resSTR = `@${user["display-name"]} уровень вашего IQ равен ${iq}.`;
                return resSTR;
            } else {
                    if ((tryNumberDB >= tryNmax) && (curTime < (lastDateDB + iqCDtime))){
                    const iqDB = usernameDB.value().iq;
                    const userCDinfoInt = Math.floor(((lastDateDB + iqCDtime) - curTime) / 1000);
                    let userCdinfoHours = Math.floor((userCDinfoInt / 60) / 60);
                    let userCdinfoMinutes = Math.floor((userCDinfoInt / 60) - (userCdinfoHours * 60));
                    let userCdinfoSeconds = Math.floor(userCDinfoInt - ((userCdinfoMinutes * 60) + (userCdinfoHours * 60 * 60)));
    
                    (userCdinfoMinutes > 0 && userCdinfoHours > 0) ? userCdinfoSeconds = ``: userCdinfoSeconds = `${userCdinfoSeconds}с`;
                    (userCdinfoHours <= 0) ? userCdinfoHours = '': userCdinfoHours = `${userCdinfoHours}ч`;
                    (userCdinfoMinutes <= 0) ? userCdinfoMinutes = '': userCdinfoMinutes = `${userCdinfoMinutes}м`;
    
                    const userCdInfoStr = `${userCdinfoHours} ${userCdinfoMinutes} ${userCdinfoSeconds}`;
    
                    return `@${user["display-name"]} Похоже, вы израсходовали все попытки на сегодня, приходите через ${userCdInfoStr}. Ваш IQ - ${iqDB}.`;
                } else if (((tryNumberDB >= tryNmax) & (curTime > (lastDateDB + iqCDtime))) || ((curTime > (lastDateDB + iqCDtime)))){
                    const iq = iq_rng(user);
                    usernameDB.assign({
    
                        iq: iq, 
                        try:1, 
                        lastDate: Date.now(),
                        count: usernameDB.value().count+1
                        
    
                    }).write();
                    tryNumberDB = 1;
                    let resSTR = `@${user["display-name"]} уровень вашего IQ равен ${iq}.`;
                    if ((tryNmax - tryNumberDB) === 0) { resSTR += ` На сегодня это все, для следующего теста приходите завтра. Хорошего дня karmikSmile` } else {resSTR += ` Осталось попыток - ${(tryNmax - tryNumberDB)}.`}
                    return resSTR;
                } else if (tryNumberDB < tryNmax ){
                    const iq = iq_rng(user);
                    usernameDB.assign({
    
                        iq: iq, 
                        try:tryNumberDB += 1, 
                        lastDate: Date.now(),
                        count: usernameDB.value().count+1
                        
    
                    }).write();
                    let resSTR = `@${user["display-name"]} уровень вашего IQ равен ${iq}.`;
                    if ((tryNmax - tryNumberDB) === 0) { resSTR += ` На сегодня это все, для следующего теста приходите завтра. Хорошего дня karmikSmile` } else {resSTR += ` Осталось попыток - ${(tryNmax - tryNumberDB)}.`}
                    return resSTR;
                }
            }
        }
    }
    

    reply(args, user){
        const users = this._iqDB.get('users');
        const usernameDB = users.find({username: user["display-name"].toLowerCase()});
        switch (args[1]) {
            case 'test':
            return this.rollIq(user);


            case 'top':
                const topDB = users.orderBy('iq', 'desc').take(5).value();
                let str ='';
                if (topDB.length === 0){
                    str = `@${user["display-name"]} Похоже, никто не проходил тест. Будьте первым! !iq test`;
                } else {
                    str = `@${user["display-name"]} Топ самых умных - `;
                    for(let i = 0; i < topDB.length; i++){
                        if (i < (topDB.length - 1)){
                            str += `${i+1}. ${topDB[i].username}: ${topDB[i].iq} IQ, `;
                            } else if( i === (topDB.length - 1)){
                                str += `${i+1}. ${topDB[i].username}: ${topDB[i].iq} IQ. `;
                            }
                    }
                }
            return str;

            case 'antitop':
                const antitopDB = users.orderBy('iq', 'asc').take(5).value();
                let str2 = '';
                if (antitopDB.length === 0) {
                    str2 = `@${user["display-name"]} Похоже, никто не проходил тест. Будьте первым! !iq test`;
                } else {
                    str2 = `@${user["display-name"]} Топ самых неумных - `;
                    for(let i = 0; i < antitopDB.length; i++){
                        if (i < (antitopDB.length - 1)){
                        str2 += `${i+1}. ${antitopDB[i].userdisplayname}: ${antitopDB[i].iq} IQ, `;
                        } else if( i === (antitopDB.length - 1)){
                            str2 += `${i+1}. ${antitopDB[i].userdisplayname}: ${antitopDB[i].iq} IQ. `;
                        }
                    }
                }
            return str2;

            case 'stats':
                const avgIQarray = users.map('iq').value();
                const allIQcountAray = users.map('count').value();
                const avgIQarrayLength = avgIQarray.length;
                let allIqcount = 0;
                for(let i = 0; i < allIQcountAray.length; i++){
                    allIqcount += allIQcountAray[i];
                }
                let allIq = 0;
                for(let i = 0; i < avgIQarray.length; i++){
                    allIq += avgIQarray[i];
                }
                const avgIQ = Math.floor(allIq / avgIQarray.length); 
            return `@${user['display-name']} Средний IQ чата - ${avgIQ}. Всего человек протестировано - ${avgIQarrayLength}. Тестов пройдено - ${allIqcount}.`;
            
            default:

                const secondSTR = 'Cписок дополнительных команд: !iq [test, top, antitop, stats]';

                if (args[1] !== undefined){
                    let getUsername = args[1];
                    getUsername = getUsername.startsWith("@") ? getUsername.substr(1) : getUsername;
                    const getUserIq = users.find({username: getUsername});
                    if(getUserIq.value() !== undefined){
                        return `@${user["display-name"]} уровень IQ ${getUserIq.value().userdisplayname} равен ${getUserIq.value().iq}.`;
                    }
                }

                if (usernameDB.value() === undefined){
                   return `@${user["display-name"]} ${secondSTR}`;

                } else{
                    const iqDB = usernameDB.value().iq;
                    return `@${user["display-name"]} Ваш IQ - ${iqDB}. ${secondSTR}`;
                }
        }
    }
}

class Bot {
    constructor(username, password){
        this.username = username;
        this._password = password;

        this.initConfig();

        if (this._config.target === 'default'){
            this.target = this.username;
        } else {
            this.target = this._config.target;
        }

        const adapterCommandsDB = new FileSync(path.join(dirDB, `commands-${this.username}.json`));
        this._commandsDB = low(adapterCommandsDB);
        this._commandsDB.defaults({
            commands:[

            ]
        }).write();

        this._iqTest = new IqTest(this.target); 

        this._state = true;
        this._CooldownTime = Date.now();

        const options = {
            options: {
            debug: false
            },
            connection: {
            cluster: "aws",
            reconnect: true
            },
            identity: {
                username: this.username,
                password: `${this._password}`
            },
            channels: [this.target]
        };

        this._client = new tmi.client(options);

        this._client.on('message', (channel, user, message, self) => {
            if(self){return};
            let messagelow = message.trim();
            messagelow = messagelow.toLowerCase();
            if(messagelow.startsWith('!')){
                if (this._config.commandsState){
                    const subMessage = messagelow.substr(1).split(' ');
                    const commandFromMessage = subMessage[0];
                    if(commandFromMessage === "commands"){
                        let resStr = "Список команд: ";
                        const allCommands = this._commandsDB.get('commands').value()
                        if (allCommands.length === 0){return}
                        allCommands.forEach((e, i)=>{
                            resStr += `!${e.command}`
                            if(i<allCommands.length-1){ resStr += ", "}
                        });
                        this._client.say(this.target, resStr);
                        return
                    }
                    const commandFromDB = this._commandsDB.get('commands').find({command: [commandFromMessage]}).value();
                    if (commandFromDB !== undefined){
                        if (commandFromDB.state){
                            const resStr = _.template(commandFromDB.description);
                            this._client.say(this.target, commandFromDB.reply ? `@${user['display-name']} `+resStr({username: user['display-name']}) : resStr({username: user['display-name']}))
                        return
                        }
                    }
                };

                if(messagelow.startsWith('!iq') && this._config.iqState){
                    const subMessage = messagelow.substr(1).split(' ');
                    this._client.say(this.target, this._iqTest.reply(subMessage, user));
                }

            }else{
                return
            }
        });
    }

    changeFunctionState(functionName, functionState){
        this._config[functionName] = functionState;
        this.updateConfig();
    }

    setCommandState(commandName, newCommandState){
        this._commandsDB.get('commands').find({command: [commandName]}).assign({
            state: newCommandState
        }).write();
    }

    initConfig(){
        let config = botConfig.get('botConfig');
        if(config.find({title: this.username}).value() === undefined){
            const defaultConfig = config.find({title: 'default'}).value();
            const newConfig = Object.assign({}, defaultConfig);
            newConfig.title = this.username;
            config.push(newConfig).write();
        }
        this._config = config.find({title: this.username}).value();
        return this._config;
    }

    updateConfig(){
        botConfig.get('botConfig').find({title: this.username}).assign(this._config).write();
        return this._config;
    }

    config(){
        return this._config;
    }

    getCommandsList(){
        return this._commandsDB.get('commands').value();
    }

    addCommand(newCommandName, newCommandDescription){
        return new Promise((resolve, reject) =>{
            let commandMatch = false;
            let commandMatchStr = '';
            newCommandName.forEach(commandName => {
                const checkCommand = this._commandsDB.get('commands').find({command: [commandName]}).value();
                if (checkCommand !== undefined || commandName === "commands"){
                    commandMatch = true;
                    commandMatchStr = commandName;
                }
            });
            if (commandMatch){
                reject(`Команда "${commandMatchStr}" уже существует`);
            }else{
                this._commandsDB.get('commands').push({
                    command: newCommandName,
                    description: newCommandDescription,
                    reply: true,
                    state: true
                }).write(); 
                resolve(true);
            }        
        })
    }

    removeCommand(commandName){
        this._commandsDB.get('commands').remove({command: [commandName]}).write();
    }

    start(){
        return new Promise((resolve, reject) => {
            this._client.connect().then((res) => {
                this._client.say(this.target, 'MrDestructoid болт вошёл в чат');
                resolve(this._config);
            }).catch((err) => {reject(err)});
        });
    } 

    stop(){
        this._client.say(this.target, 'Отключаюсь..');
        return new Promise((resolve, reject) =>{
            this._client.disconnect().then((res) => { 
                resolve(true);
            }).catch((err) => {
                reject(err);    
            });    
        })
        
    }

}

module.exports = Bot;