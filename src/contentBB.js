port = chrome.runtime.connect(); 
function getConnection() {
  return new Promise(resolve => {
    function ping() {
      chrome.runtime.sendMessage('ping', response => {
        if(chrome.runtime.lastError) {
          setTimeout(ping, 500);
        } else {
          resolve(true)
        }
      });
    }
    ping()
  })
}

function getMenuList() {
    const panel = $('.panel-content')
    const menu = panel.children('.menu-list')

    if (menu[0]) {
        return $(menu[0])
    } else {
        return
    }
}

function awaitMenu () {
    return new Promise(resolve => {
        const interval = setInterval(() => {
            const menu = getMenuList()
            if (menu) {
                clearInterval(interval)
                return resolve(menu)
            }
        }, 200)
    })
}

function getVideoLink () {
    const video = $('#playback-video-playback-video_html5_api')

    if (video[0]) {
        return video.attr('src')
    } else {
        return
    }
}

function awaitVideoLink () {
    return new Promise(resolve => {
        const interval = setInterval(() => {
            const url = getVideoLink()
            if (url) {
                clearInterval(interval)
                return resolve(url)
            }
        }, 200)
    })
}

function getVideoName () {
    const nameContainer = $('#recording-name')

    if (nameContainer[0]) {
        return nameContainer.text()
    } else {
        return
    }
}

function checkForRecordingDownload (menu) {
    const downloadElem = menu.find('#download-recording')
    return downloadElem.length > 0
}

async function downloadVideo (link) {
    let name = getVideoName()
    if (name) {
        name = name.replace(/[^a-z0-9]/gi, '_').replace(/__+/gi, '_').toLowerCase()
        if (link.indexOf(".mp4") > -1) {
            name = name+".mp4"
        } else {
            name = undefined
        }
    }
    await getConnection()
    port.postMessage({type: "bb_colab_download", link, name});
}

function constructDownloadButtong (link) {
    const insert = $(`
        <li class="main-menu__item ng-scope">
            <button 
                class="main-menu__control menu-list__control"
                id="download-recording"
                bb-translate-attrs="{'aria-label': 'recording.menu.download-recording'}"
                aria-label="Download recording"
            >
                <span class="menu-list__inner-wrap">
                    <bb-svg-icon class="menu-list__icon ng-isolate-scope" name="download-chat" size="medium"><svg class="svg-icon medium default" ng-class="{'default': !svgIcon.color, 'color': svgIcon.color}" focusable="false" aria-hidden="true">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" id="medium--download-recording"><path fill="none" stroke-linecap="round" stroke-miterlimit="10" d="M20.5 15.5h2.348c.36 0 .652.292.652.652v6.696c0 .36-.292.652-.652.652h-8.696a.652.652 0 01-.652-.652v-6.696c0-.36.292-.652.652-.652H16.5"></path><path fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" d="M21.5 18.5l-3 3-3-3M18.5 13.5v8M9.5 15.5v-8l6 4-6 4z"></path><path fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" d="M10.5 23.5h-8a2 2 0 01-2-2v-19a2 2 0 012-2h19a2 2 0 012 2v10M4.5 1v22M19.5 1v9.5M1 4.5h3M1 8.5h3M1 12.5h3M1 16.5h3M1 20.5h3M20 4.5h3M20 8.5h3"></path></svg>
                    </bb-svg-icon>
                    <span class="ng-scope">Download recording</span>
                </span>
            </button>
        </li>
    `)
    const button = insert.children('button')
    button.click(() => {
        downloadVideo(link)
    })
    return insert
}

async function main() {
    const menu = await awaitMenu()
    const hasDownload = checkForRecordingDownload(menu)
    if (hasDownload) {
        return;
    }

    const link = await awaitVideoLink()

    const button = constructDownloadButtong(link)
    menu.prepend(button)
    console.log("Inserted new download button")
}

main()