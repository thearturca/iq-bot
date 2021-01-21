const keytar = require('keytar');
keytar.findCredentials('200iqbot').then((res)=>{
    console.log(res)
})