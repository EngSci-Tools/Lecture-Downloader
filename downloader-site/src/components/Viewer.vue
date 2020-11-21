<template>
    <div id="viewer">
        <div id="inputs">
            <img alt="Vue logo" src="../assets/uoft.png">
            <h1>UofT Lecture Downloader</h1>
            <input type="text" value='https://play.library.utoronto.ca/e359e6e5ad153967b22603fb4fb03c00' placeholder="Lecture Id or Link" @input="updateId"/>
            <p>{{ currentId ? `Extracted Id: ${currentId}` : "Please enter a link to a lecture or a lecture id" }}</p>
            <button id="view-button" @click='watchCurrentId' :disabled='!currentId'>
                <span v-if='!processing && !downloading'>Download</span>
                <span v-if='processing'>{{ processingMessage }}</span>
                <loading v-if='downloading'></loading>
            </button>
            <p v-if='downloadFailed'>{{ downloadFailedMessage }}</p>
            <p id="extension"><a href="https://chrome.google.com/webstore/detail/uoft-video-downloader/ndnkcmibkplamecekdhikoadjamfcpfk?hl=en" target="_blank">Get the Extension</a> | <a href="https://github.com/EngSci-Tools/Lecture-Downloader/issues" target="_blank">Submit an Issue</a></p>
        </div>
        <!-- <div id="view">
            <h2>Statistics: Note that no identifiable information is stored.</h2>
            <Graph></Graph>
            <SummaryTable></SummaryTable>
        </div> -->
    </div>
</template>

<script>
import axios from 'axios';
import Circle from 'vue-loading-spinner/src/components/Circle.vue'
// import Graph from '@/components/filesGraph'
// import SummaryTable from '@/components/summaryTable'
import io from 'socket.io-client';

export default {
    name: "Viewer",
    components: {
        loading: Circle,
        // Graph,
        // SummaryTable
    },
    data: () => ({
        socket: io('http://localhost'),

        currentLink: undefined,
        currentId: undefined,
        processing: false,
        processingMessage: '',
        downloading: false,
        downloadFailed: false,
        downloadFailedMessage: '',
        urlConfigurations: [
            { r: /(https:\/\/mymedia.library.utoronto.ca\/api\/download\/thumbnails\/)(.+)(\..+)/, pos: 1 },
            { r: /(https:\/\/play.library.utoronto.ca\/embed\/)(.+)(\?.+)?/, pos: 1 },
            { r: /(https:\/\/play.library.utoronto.ca\/)(play\/)?(.+)(\?.+)?/, pos: 2 }
        ]
    }),
    mounted () {
        console.log('Trying to connect', this.socket, this.socket.io.engine.transport.name)
        this.socket.on('connect', () => {
            console.log('Socket type:', this.socket.io.engine.transport.name);
        })
        this.socket.on('test', () => {
            console.log('Tested')
        })
        this.socket.emit('test', {asdf: 1})

        this.socket.on('finished', meta => {
            const { ready, link, id, error } = meta
            console.log("Finished", meta)
            if (this.currentId === id) {
                this.processing = false
                if (ready) {
                    this.download(link)
                } else {
                    this.setDownloadFailed(error)
                }
            }
        })

        this.socket.on('progress', meta => {
            const { progress, id } = meta
            console.log("Progress", meta)
            if (this.currentId === id) {
                this.processing = true
                const percent = Math.round(progress * 100)
                const append = percent > 99 ? 'Uploading' : `${percent}%`
                this.processingMessage = `Processing: ${append}`
            }
        })
    },
    watch: {
        currentId () {
            console.log("New Id", this.currentId)
            // this.watchCurrentId()
        }
    },
    methods: {
        updateId(e) {
            const url = e.target.value;
            for (const opt of this.urlConfigurations) {
                const arr = url.match(opt.r);
                if (arr) {
                    const id = arr[opt.pos + 1];
                    this.currentId = id;
                    return;
                }
            }
            this.currentId = url;
            return;
        },
        async watchCurrentId() {
            this.socket.emit('download', { id: this.currentId })
        },
        setDownloadFailed (msg) {
            this.downloadFailed = true
            this.downloadFailedMessage = msg
        },
        async download (link) {
            this.downloadFailed = false;
            this.downloading = true;
            try {
                const response = await axios({
                    url: link,
                    method: 'GET',
                    responseType: 'blob',
                })
                var fileURL = window.URL.createObjectURL(new Blob([response.data]));
                var fileLink = document.createElement('a');

                this.logMeta(true)
            
                fileLink.href = fileURL;
                fileLink.setAttribute('download', 'lecture.mp4');
                document.body.appendChild(fileLink);
            
                fileLink.click();
                this.downloading = false;
            } catch(err) {
                this.downloadFailed = true;
                this.downloading = false;
            }
        },
        async logMeta(success) {
            const id = this.currentId
            this.socket.emit('addMeta', { fromsite: true, success, id })
        }
    }
}
</script>

<style lang="less" scoped>
#viewer {
    font-family: Avenir, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    color: #2c3e50;

    min-height: 100vh;
    width: 100vw;
    display: flex;
    flex-direction: column;
    align-items: center;
    #inputs {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        height: 100vh;

        #extension {
            margin-top: auto;
            margin-bottom: 10px;
        }

        img {
            height: 40vh;
        }

        input {
            width: 70vw;
            height: 2rem;
        }
        
        p {
            margin-bottom: 2px;
        }

        #view-button {
            font-size: 15px;
            background: rgb(207, 232, 255);
            color: rgb(49, 130, 206);
            border-radius: 5px;
            border: none;
            padding: 5px 10px;
            transition: background-color 0.25s ease;
            cursor: pointer;

            &:hover {
                background: rgb(188, 222, 253);
            }
        }
    }

    #view {
       display: flex;
       flex-direction: column;
       align-items: center;
    }
}
</style>