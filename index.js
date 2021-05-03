require('dotenv').config()
const { Telegraf } = require('telegraf')
const bot = new Telegraf(process.env.TOKEN)


//database 

const db = require('./config/connection')
const collection = require('./config/collection')
const saver = require('./database/filesaver')


//DATABASE CONNECTION 
db.connect((err) => {
    if (err) { console.log('error connection db' + err); }
    else { console.log('db connected'); }
})


//BOT

bot.start(async(ctx)=>{

    msg = ctx.message.text
    let msgArray = msg.split(' ')
    console.log(msgArray.length);
    let length = msgArray.length
    msgArray.shift()
    let query = msgArray.join(' ')

    user ={
        first_name:ctx.from.first_name,
        userId:ctx.from.id
    }

    //welcoming message on /start and if there is a query available we can send files

    if(length == 1){
        ctx.reply(`<b>Almacenaré archivos para usted y proporcionaré enlaces para compartir. También puedo hacer que los archivos estén disponibles para todos los usuarios</b>`,{
            parse_mode:'HTML',
            reply_markup:{
                inline_keyboard:[
                    [{text:'Buscar',switch_inline_query:''},{text:'Link',callback_data:'POP'}]
                ]
            }
        })
    }else{
        file = await saver.getFile(query).then((res)=>{
            console.log(res);
            file = await saver.getFile(query).then((res)=>{
                console.log(res);
                if(res.type=='video'){
                    ctx.replyWithVideo(res.file_id,{caption:`<b>${res.caption}</b>`,
                parse_mode:'HTML'})
                }else{
                    ctx.replyWithDocument(res.file_id,{caption:`<b>${res.caption}</b>`,
                parse_mode:'HTML'})
                }
                
            })
        })
    }
    //saving user details to the database

    saver.saveUser(user)   
    
})

//DEFINING POP CALLBACK
bot.action('POP',(ctx)=>{
    ctx.deleteMessage()
    ctx.reply('send me a file')
})

//help

bot.command('/help',(ctx)=>{
    ctx.reply(`Hola <b>${ctx.from.first_name}</b> puede enviarme archivos y almacenaré y compartiré el enlace para que ese archivo se use dentro de Telegram  \n También puede utilizarme para buscar archivos aportados por varios usuarios\n\n(Creado para Anne Belen por @FermaniF)`,{
        parse_mode:'HTML',
        reply_markup:{
            inline_keyboard:[
                [{text:'🎲 Novedades ',url:'t.me/botnovedades'}]
            ]
        }    
    })
})

//broadcasting message to bot users

bot.command('send',async(ctx)=>{
    msg = ctx.message.text
    let msgArray = msg.split(' ')
    msgArray.shift()
    let text = msgArray.join(' ')

    userDetails = await saver.getUser().then((res)=>{
        n = res.length
        userId = []
        for (i = 0; i < n; i++) {
            userId.push(res[i].userId)
        }

        //broadcasting
        totalBroadCast = 0
        totalFail = []

        //creating function for broadcasting and to know bot user status
        async function broadcast(text) {
            for (const users of userId) {
                try {
                    await bot.telegram.sendMessage(users, String(text))
                } catch (err) {
                    saver.updateUser(users)
                    totalFail.push(users)

                }
            }
            ctx.reply(`<b>✅ Total de usuarios activos :</b>${userId.length - totalFail.length}\n❌<b>Transmisión fallida total:</b>${totalFail.length}`,{
                parse_mode:'HTML'
            })

        }
        if (ctx.from.id == process.env.ADMIN) {
            broadcast(text)
        }else{
            ctx.replyWithAnimation('https://media.giphy.com/media/fnuSiwXMTV3zmYDf6k/giphy.gif')
        }

    })
})

//saving documents to db and generating link

bot.on('document',(ctx)=>{
    document = ctx.message.document
    console.log(ctx);
    fileDetails ={
        file_name:document.file_name,
        file_id:document.file_id,
        caption:ctx.message.caption,
        file_size:document.file_size,
        uniqueId:document.file_unique_id
    }
    console.log(fileDetails.caption);
    saver.saveFile(fileDetails)
    ctx.reply(`https://t.me/${process.env.BOTUSERNAME}?start=${document.file_unique_id}`)
})

//checking bot status only for admins 

bot.command('stats',async(ctx)=>{
    stats = await saver.getUser().then((res)=>{
        if(ctx.from.id==process.env.ADMIN){
            ctx.reply(`📊Total usuarios: <b> ${res.length}</b>`,{parse_mode:'HTML'})
        }
        
    })
})


//getting files as inline result

bot.on('inline_query',async(ctx)=>{
    query = ctx.inlineQuery.query
    if(query.length>0){
        let searchResult = saver.getfileInline(query).then((res)=>{
            let result = res.map((item,index)=>{
                return {
                    type:'document',
                    id:item._id,
                    title:item.file_name,
                    document_file_id:item.file_id,
                    caption:item.caption,
                    reply_markup:{
                        inline_keyboard:[
                            [{text:"🔎 Busca de nuevo",switch_inline_query:''}]
                        ]
                    }
                }
            })
           
            ctx.answerInlineQuery(result)
        })
    }else{
        console.log('query not found');
    }
    
})



//heroku config
domain = `${process.env.DOMAIN}.herokuapp.com`
bot.launch({
    webhook:{
       domain:domain,
        port:Number(process.env.PORT)

    }
})

