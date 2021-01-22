const { ipcRenderer } = require("electron")
 class UI{

    static closeApp(){
        ipcRenderer.send('UI', {action: 'close'}).catch((err) => {
            UI.showNotice('error', noticeBlock, 'Error', err);
        });;
    }

    static HideApp(){
        ipcRenderer.send('UI', {action: 'hide'}).catch((err) => {
            UI.showNotice('error', noticeBlock, 'Error', err);
        });;
    }

    static toggleDarkTheme(){
        document.querySelector('body').classList.add('dark-theme');
    }

    static toggleLightTheme(){
        document.querySelector('body').classList.remove('dark-theme');
    }

    static toggleTheme(theme){
        switch (theme){
            case 'dark':
                UI.toggleDarkTheme();
            break;
            case 'light':
                UI.toggleLightTheme();
            break;
            default:
                UI.toggleLightTheme();
            break;
        }
    }

    static toggleHideBtn(mainWinClose){
        switch(mainWinClose){
            case "close":
                document.querySelector('header').querySelector('#hide-btn').style = 'display: block;'
            break;
            case "hide":
                document.querySelector('header').querySelector('#hide-btn').style = 'display: none;'
            break;
            default:
                document.querySelector('header').querySelector('#hide-btn').style = 'display: none;'
            break;
        }
    }

    static showModal(type, window, username, theme, mainWinClose){
        theme === undefined ? theme = 'light' : theme = theme;
        switch (type){
            case 'dropdown-settings':
                window.querySelector('#modal-header').querySelector('h3').innerHTML = username;
                window.querySelector('#modal-header').querySelector('h2').innerHTML = 'Настройки';
                window.querySelector('#modal-body').innerHTML = `<div class="select first">
                <label for="theme">Тема</label>
                <select name="setTheme" id="theme" onchange="switchTheme(this)">
                    <option value="light" ${theme === 'light' ? 'selected="selected"' : ''}>Светлая</option>
                    <option value="dark" ${theme === 'dark' ? 'selected="selected"' : ''}>Тёмная</option>
                </select>
            </div>
            <div class="select">
                <label for="setMainWinClose">Поведение кнопки "закрыть"</label>
                <select name="setMainWinClose" id="mainWinClose" onchange="switchMainWinClose(this)">
                    <option value="hide" ${mainWinClose === 'hide' ? 'selected="selected"' : ''}>Скрыть в трей</option>
                    <option value="close" ${mainWinClose === 'close' ? 'selected="selected"' : ''}>Закрыть приложение</option>
                </select>
            </div>`;
            break;
            case 'commands-list':
                window.querySelector('#modal-header').querySelector('h3').innerHTML = 'Команды';
                window.querySelector('#modal-header').querySelector('h2').innerHTML = 'Список команд';

                const commandArayToStr = (commandsArray) =>{
                    let resStr = '';
                    commandsArray.forEach((command, i, array) =>{
                        resStr += `${command}${i<array.length-1 ? ', ': ''}`;
                    });
                    return resStr
                }
                
                ipcRenderer.invoke('botConfig', {action: 'getCommandsList'}).then((res)=>{
                    const commandslist = res;
                    let HTMLFromCommands ='';
                commandslist.forEach((command) => {
                    HTMLFromCommands += ` <li class="list-item">
                    <label>
                        <input id="commandState" type="checkbox" name="${command.command[0]}" ${command.state ? 'checked' : ''}>
                        <span class="checkbox-fake"></span>
                    </label>
                    <div class="list-item-commandName">
                    <textarea disabled>${commandArayToStr(command.command)}</textarea>
                    <!--<input type="text" value="${commandArayToStr(command.command)}" disabled>-->
                    </div>
                    <div class="list-item-commandDiscription">
                       <textarea name="" id="" disabled>${command.description}</textarea> 
                        <div class="delete-container">
                            <a class="delete" id="delete">
                                <i class="delete-icon"></i>
                            </a>  
                        </div>
                    </div>
                </li>`;
                });

                const modalBodyCommandsList = `<div class="newCommand-form-btn-container">
                <button class="btn btn-newCommand-form" id="btn-newCommand-form">Добавить</button >
                <span class="info">Чтобы изменить команду, щёлкните по ней два раза левой кнопкой мыши</span>
                </div>
                <div class="commands-list">
                    <div class="commands-list-header">
                        <ul>
                            <li>вкл/выкл</li>
                            <li>Название команды</li>
                            <li>Описание команды</li>
                        </ul>
                    </div>
                    <div class="commands-list-body">
                        <ul>
                            ${HTMLFromCommands}         
                        </ul>
                    </div>
                </div>`;

                window.querySelector('#modal-body').innerHTML = modalBodyCommandsList;

                window.querySelector('#modal-body').querySelectorAll('#commandState').forEach((checkbox)=>{
                    checkbox.addEventListener('change', (e) => {
                        ipcRenderer.invoke('botConfig', {action: 'commandState', commandName: e.target.name, commandState: e.target.checked}).then((res)=> {

                        }).catch((err) =>{
                            UI.showNotice('error', noticeBlock, 'Ошибка', err);
                        });
                    });

                });

                window.querySelector('#modal-body').querySelector('.commands-list-body').querySelectorAll('#delete').forEach((deleteBtn) =>{
                    deleteBtn.addEventListener('click', (e)=>{
                        const commandName = e.target.parentElement.parentElement.parentElement.parentElement.querySelector('#commandState').name;

                        UI.showConfirmationModal(window, {action: 'removeCommand', commandName: commandName})
                    })
                })

                window.querySelector('#modal-body').querySelector('#btn-newCommand-form').addEventListener('click', (e)=>{
                    e.preventDefault();
                    UI.showModal('addNewCommand-form', modalWindow, username);
                })
                }).catch((err)=>{
                    UI.showNotice('error', noticeBlock, 'Ошибка', err);
                });
            
            break;
            case 'addNewCommand-form':
                window.querySelector('#modal-header').querySelector('h3').innerHTML = 'Список команд';
                window.querySelector('#modal-header').querySelector('h2').innerHTML = 'Добавить новую команду';
                window.querySelector('#modal-body').innerHTML = `<form id="addNewCommand-form">
                <div class="input-text first">
                    <label for="newCommandName">Новая команда</label>
                    <input type="text" name="newCommandName" id="newCommandName" autofocus>
                    <span style="margin-top: 6px; margin-bottom: 6px">Для добаление нескольких слов, пишите их через пробел</span>
                </div>
                <div class="input-text">
                    <label for="newCommandDiscription">Описание новой команды</label>
                    <textarea name="newCommandDescription" id="newCommandDescription"> </textarea>
                </div>
                <button type="submit" class="btn-addNewCommand">Добавить</button>
                </form>`;
                window.querySelector('#modal-body').querySelector('#addNewCommand-form').addEventListener('submit', (e)=>{
                    e.preventDefault();
                    const form = window.querySelector('#modal-body').querySelector('#addNewCommand-form');
                    let inputNewCommandName = form.querySelector('#newCommandName').value;
                    inputNewCommandName = inputNewCommandName.trim().toLowerCase();
                    inputNewCommandName = inputNewCommandName.replace(/[|&;$%@"<>(),!?.'~`#^*}{]/g, "");
                    inputNewCommandName = inputNewCommandName.split(' ');

                    let inputNewCommandDescription = form.querySelector('#newCommandDescription').value;
                    inputNewCommandDescription = inputNewCommandDescription.trim();

                    const re = /^[А-ЯЁа-яёa-zA-Z0-9]{3,}$/;

                    ipcRenderer.invoke('botConfig', {action: 'addCommand', commandName: inputNewCommandName, commandDescription: inputNewCommandDescription}).then((res) =>{
                        UI.showNotice('success', noticeBlock, 'Успех', `Команда "${inputNewCommandName}" успешно добавлена`);
                        UI.showModal('commands-list', modalWindow, username);
                    }).catch((err) =>{
                        UI.showNotice('error', noticeBlock, 'Ошибка', err);
                    })
                    
                });
                
            break;
            
        }
        
        window.classList.remove('hide');
    }

    static showNotice(type, noticeBlock, title, body){
        let timer = null;

        const infoClass = 'notice-info';
        const errorClass = 'notice-error';
        const successClass = 'notice-success';

        noticeBlock.classList.remove(infoClass);
        noticeBlock.classList.remove(errorClass);
        noticeBlock.classList.remove(successClass);

        let noticeClass = infoClass;
        let timeoutsec = 5000;

        noticeBlock.querySelector('#notice-title').innerHTML = `<h3>${title}</h3>`;
        noticeBlock.querySelector('#notice-body').innerHTML = `<p>${body}</p>`;

        switch (type){
            case 'info':
                noticeClass = infoClass;
            break;

            case 'error':
                noticeClass = errorClass;
                timeoutsec = 10000;
            break;

            case 'success':
                noticeClass = successClass;
            break;

            default:
                noticeClass = infoClass;
            break;
        }

        noticeBlock.classList.add(noticeClass);
        noticeBlock.classList.remove('hide');
        timer = setTimeout(()=> {
            noticeBlock.classList.add('hide');
            noticeBlock.classList.remove(noticeClass);
        }, timeoutsec);
    }

    static showSettings(e, settingsDropdownMenu){
        settingsDropdownMenu.style = "display: block";

    }

    static showConfirmationModal(window, settings){
        let bodyString;
        switch (settings.action){
            case 'removeCommand':
                bodyString = `Вы точно хотите удалить команду "${settings.commandName}"?`;
            break;
            case 'logout':
                bodyString = `Вы уверены, что хотите выйти из аккаунта?`
                break;
        }
        const confirmationModal = `<div id="sub-modal-container" class="modal-container">
        <div class="modal-content">
            <div class="modal-header" id="sub-modal-header">
                <div class="modal-title" id="modal-title">
                    <h2>Подтверждение</h2>  
                </div>
                <div class="close-container">
                    <a class="close" id="close">
                        <i class="close-icon"></i>
                    </a>  
                </div> 
            </div>
            <div class="modal-body" id="sub-modal-body">
                <span style="display: block; margin-bottom: 24px">${bodyString}</span>
                <button class="btn btn-second" id="btn-cancel">отмена</button>
                <button class="btn" style="width: 120px" id="btn-yes">Да</button>
            </div>
        </div>
    </div>`;
    const newNode = document.createElement('div')
    newNode.innerHTML = confirmationModal;
        window.insertBefore(newNode, window.firstChild);
        window.querySelector('#sub-modal-header').querySelector('#close').addEventListener('click', (e)=>{
            e.preventDefault();
            window.querySelector('#sub-modal-container').classList.add('hide');
        });
        window.querySelector('#sub-modal-body').querySelector('#btn-cancel').addEventListener('click', (e)=>{
            e.preventDefault();
            window.querySelector('#sub-modal-container').classList.add('hide');
        });

        window.querySelector('#sub-modal-body').querySelector('#btn-yes').addEventListener('click', (e)=>{
            e.preventDefault();
            ipcRenderer.invoke('botConfig', settings).then((res)=>{
                switch(settings.action){
                    case 'removeCommand':
                        UI.showNotice('success', noticeBlock, 'Успех', `Команда "${settings.commandName}" успешно удалена`);
                        UI.showModal('commands-list', modalWindow, username);
                        window.querySelector('#sub-modal-container').classList.add('hide');
                    break;
                    case 'logout':
                        window.querySelector('#sub-modal-container').classList.add('hide');
                        break;
                }

                
            }).catch((err) =>{
                UI.showNotice('error', noticeBlock, 'Ошибка', err);
            })
        })
        

    }
}

module.exports = { UI }