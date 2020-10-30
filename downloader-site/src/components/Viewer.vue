<template>
    <div id="viewer">
        <div id="inputs" v-if='!hasId'>
            <img alt="Vue logo" src="../assets/uoft.png">
            <h1>UofT Lecture Downloader</h1>
            <input type="text" placeholder="Lecture Id or Link" @input="updateId"/>
            <p>{{ provId ? `Extracted Id: ${provId}` : "Please enter a link to a lecture or a lecture id" }}</p>
            <!-- <a :href='provDownloadLink' download='lecture.mp4' target="_blank"> -->
            <button id="view-button" :onclick='getLectures' :disabled='!provId'>
                <span v-if="!downloading">Download</span>
                <Circle v-else></Circle>
            </button>
            <p v-if='downloadFailed'>Download failed. Try manually opening this link and clicking the button in bottom left corner to download:<br/><a @click="logMeta(true)" :href='provDownloadLink' target="_blank">{{ provDownloadLink }}</a></p>
            <!-- </a> -->
        </div>
        <div id="view" v-else>
            <!-- <iframe :src='currentEmbededLink'/> -->
        </div>
        <a href="https://chrome.google.com/webstore/detail/uoft-video-downloader/ndnkcmibkplamecekdhikoadjamfcpfk?hl=en" target="_blank" id="extension">Get the Extension</a>
    </div>
</template>

<script>
import axios from 'axios';
import Circle from 'vue-loading-spinner/src/components/Circle.vue'

export default {
    name: "Viewer",
    components: {
        Circle
    },
    data: () => ({
        provId: undefined,
        currentId: undefined,
        downloading: false,
        downloadFailed: false,
        urlConfigurations: [
            { r: /(https:\/\/mymedia.library.utoronto.ca\/api\/download\/thumbnails\/)(.+)(\..+)/, pos: 1 },
            { r: /(https:\/\/play.library.utoronto.ca\/embed\/)(.+)(\?.+)?/, pos: 1 },
            { r: /(https:\/\/play.library.utoronto.ca\/)(play\/)?(.+)(\?.+)?/, pos: 2 }
        ]
    }),
    computed: {
        hasId() {
            return this.currentId !== undefined;
        },
        currentEmbededLink() {
            return `https://play.library.utoronto.ca/embed/${this.currentId}`;
        },
        provDownloadLink() {
            return `https://play.library.utoronto.ca/api/download/${this.provId}.mp4`;
        }
    },
    methods: {
        updateId(e) {
            const url = e.target.value;
            for (const opt of this.urlConfigurations) {
                const arr = url.match(opt.r);
                if (arr) {
                    const id = arr[opt.pos + 1];
                    this.provId = id;
                    return;
                }
            }
            this.provId = url;
            return;
        },
        async logMeta(success) {
            axios({
                url: `/setMeta/${this.provId}`,
                method: 'POST',
                data: { fromsite: true, success }
            })
        },
        async getLectures() {
            this.downloadFailed = false;
            this.downloading = true;
            try {
                const response = await axios({
                    url: this.provDownloadLink,
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
        }
    }
}
</script>

<style lang="less" scoped>
#viewer {
    height: 100vh;
    width: 100vw;
    display: flex;
    flex-direction: column;
    align-items: center;
    #inputs {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
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
        width: 100%;
        flex-grow: 1;
        iframe {
            width: 90%;
            height: 100%;
        }
    }

    #extension {
        margin-top: auto;
        margin-bottom: 10px;
    }
}
</style>