import * as musicMetadata from 'music-metadata'
import fetch from 'node-fetch'
import got from 'got'

import AudioFileInfo from './types'
import DBConnect from './db'
import socketIO from "socket.io"




export default class SocketServer{
    io: socketIO.Server
    db: DBConnect

    constructor(){
        //create the db connection
        this.db = new DBConnect()
        //create and start the socket server
        this.io = socketIO()
        this.io.listen( parseInt(process.env.PORT)+1 )
        //initialze the server functions
        this.setup()
    }

    /**
     * defines the socket interface
     */
    private setup(){
        //===================
        //socketio setup
        //this is where we provide backend functionality for our app
        this.io.on('connection', (socket: SocketIO.Socket) => { 

            //log when a client connects
            console.log("client connected", socket.client.id)
    
            //when a client requests a new dropbox folder url be assigned as thier playlist
            //logg the request and begin processing the request
            socket.on("readDropBoxFolder", (dropBoxfolderUrl, sessionId:string) => {
                console.log(`getting dropBoxfolder for ${sessionId}: `, dropBoxfolderUrl)
                this.processDropBoxfolderAndReply(dropBoxfolderUrl, socket, sessionId)
            })
    
            //when a session playlist is requested find it and deliver it to the client
            socket.on('getSessionPlaylist', (sessionId:string) => {
    
                this.db.getSessionList(sessionId).then(playlistData => {
                    //if no list is found we wil need to return an empty one
                    const blank : AudioFileInfo[] = []
                    const playlist = playlistData ? playlistData : blank
                    //log the playlist
                    console.log(`sending playlist for session: ${sessionId}: `, playlist)
                    //deliver it to the client
                    socket.emit('deliverSessionPlaylist', playlist)
                })
    
            })
    
        })
    }


    /**
     * pulls meta data for one audio file url
     * @param url 
     */
    private async parseStream (url:string): Promise<musicMetadata.IAudioMetadata> {
        console.log("getting meta for: ", url)
        // Read HTTP headers
        const response:any = await fetch(url); 
        // Extract the content-type
        const contentType = response.headers.get('content-type'); 
        //parse the stream
        const metadata = await musicMetadata.parseStream(response.body, {mimeType: contentType}, {duration:true, skipPostHeaders:true, skipCovers:true})
        return metadata
    }

    
    /**
     * Gathers .oop links from a dropbox folder, formats them for download,
     * pulls all metadata, and then sends it back to the client
     * @param url 
     * @param socket
     * @param sessionId
     */
    private async processDropBoxfolderAndReply (url:string, socket:socketIO.Socket, sessionId:string) {
        //pull the page from the provided url
        const response = await got(url as string)
        //create the regex to match the file links
        const regex = /(https:\/\/www.dropbox\.com\/sh[a-zA-Z0-9%-?_]*(\.ogg))/gm
        //pull all the links from the body
        const matches = response.body.match(regex)
        //get rid of any duplicates
        const links = [... new Set(matches)]
        //log all of the links
        console.log(`${sessionId} links found: `, links)
        //create the array for the file info we will find
        const musicFileInfoArray : AudioFileInfo[] = []
        //pull the metadata for each file and save it to the array
        for (let index = 0; index < links.length; index++) {
            var link = links[index]
            link = link.replace('www.dropbox', 'dl.dropboxusercontent')
            const data = await this.parseStream(link)
            musicFileInfoArray.push( {name: data.common.title, duration: data.format.duration, url:link, fileName:''} )
        }
        //save the results for next time the user:session starts
        console.log(`saving playlist for: `, sessionId)
        this.db.saveNewSessionList(sessionId, musicFileInfoArray)
        //send the final results back to the user
        socket.emit('deliverReadDropBoxfolder', musicFileInfoArray)
    }

}