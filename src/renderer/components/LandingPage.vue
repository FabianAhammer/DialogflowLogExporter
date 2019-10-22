<template>
  <div id="wrapper">
    <main>
      <h1 class="title">
        <span class="small-text">Dia</span>log
        <span class="small-text">flow</span>
        <span>&nbsp;</span>
        Viewer
      </h1>
      <div></div>
      <br />
      <button @click="open()">Dialogflow Login</button>

      <input type="file" value="Load Local File" @change="loadFile" />
      <button @click="exportJson()">Export JSON</button>

      <br />
      <br />
      <DynamicScroller
        class="scroller"
        :items="filteredConversations"
        :min-item-size="50"
        key-field="conversationId"
        page-mode
      >
        <template v-slot="{item, index, active}">
          <DynamicScrollerItem
            :item="item"
            :active="active"
            :data-index="index"
            :size-dependencies="[]"
            class="conversation-container"
          >
            <div class="conversation">
              <div
                class="interaction"
                v-for="interaction in item.interactions"
                :key="interaction.id"
              >
                <div
                  class="guest-text"
                  v-if="active"
                  v-html="highlightText(interaction.conversationResponse.queryText)"
                ></div>
                <div class="guest-text" v-else>
                  <div>{{interaction.conversationResponse.queryText}}</div>
                </div>

                <div class="leonie-text-container">
                  <div
                    class="leonie-text-lazy"
                    v-if="active"
                    v-html="highlightText(interaction.conversationResponse.conversationText)"
                  ></div>
                  <div
                    class="leonie-text-lazy"
                    v-else
                  >{{interaction.conversationResponse.conversationText}}</div>
                </div>
                <div class="timestamp">{{interaction.conversationResponse.timestamp}}</div>
              </div>
            </div>
          </DynamicScrollerItem>
        </template>
      </DynamicScroller>
      <!--
          
      <transition-group name="conversation-list" tag="div">
        <div
          class="conversation"
          v-for="conversation in filterConversations(logs.conversations)"
          :key="conversation.conversationId"
        >
          <div
            class="interaction"
            v-for="interaction in conversation.interactions"
            :key="interaction.id"
          >
            <div
              class="guest-text"
              v-html="highlightText(interaction.conversationResponse.queryText)"
            ></div>
            <div class="leonie-text-container">
              <div
                class="leonie-text-lazy"
                v-observe-visibility="(isVisible, entry) => showText(isVisible, entry, interaction.conversationResponse)"
              >loading...{{interaction.conversationResponse.conversationText}}</div>
            </div>
            
            <div class="timestamp">{{ interaction.conversationResponse.timestamp}}</div>
          </div>
        </div>
      </transition-group>
      -->
      <div class="bottom-bar">
        <button @click="changePage(false)">Previous</button>
        <input type="text" placeholder="Search" v-model="filterText" />
        <button @click="changePage(true)">Next</button>
      </div>
    </main>
  </div>
</template>
<script>
import SystemInformation from "./LandingPage/SystemInformation";
import { setInterval, clearInterval } from "timers";
import { readFileSync, writeFile } from "fs";
import VueJsonPretty from "vue-json-pretty";
import { ipcRenderer } from "electron";

export default {
  name: "landing-page",
  components: { SystemInformation, VueJsonPretty },
  data() {
    return {
      filterText: "",
      bearerToken: "",
      pageTokens: [""],
      pageIndex: 0,
      dialogflowCookies: "",
      logs: {
        conversations: [
          {
            conversationId: 0,
            interactions: [
              {
                id: "",
                conversationResponse: {
                  queryText: "",
                  conversationText: "",
                  fulfillmentMessages: [
                    {
                      text: {
                        text: [""]
                      }
                    }
                  ],
                  timestamp: ""
                }
              }
            ]
          }
        ]
      },
      nextPageToken: "",
      googleHeaders: {}
    };
  },
  computed: {
    filteredConversations() {
      let r = new RegExp(this.filterText, "i");
      let conversations = this.logs.conversations;
      return conversations.filter(conversation => {
        return conversation.interactions.some(interaction => {
          let leonieText = interaction.conversationResponse.queryText;
          let userText = interaction.conversationResponse.conversationText;
          return r.test(leonieText) || r.test(userText);
        });
      });
    }
  },
  mounted() {
    ipcRenderer.on("headers", (event, message) => {
      this.googleHeaders = JSON.parse(message);
    });
  },
  methods: {
    loadFile(e) {
      let files = e.target.files || e.dataTransfer.files;
      if (!files.length) return;
      let file = files[0];
      let reader = new FileReader();
      let self = this;
      reader.onload = function(e) {
        var contents = e.target.result;
        self.displayLogs(JSON.parse(contents));
      };
      reader.readAsText(file);
    },
    open() {
      /** @type {BrowserWindowProxy} */
      let dialogflowWindow = window.open(
        "https://console.dialogflow.com/api-client/",
        "_blank",
        "nodeIntegration=no"
      );

      let dialogflowCookies = "";
      let windowMessageCallback = m => {
        dialogflowCookies = m.data;
        console.log(dialogflowCookies + "\n");
      };
      window.addEventListener("message", windowMessageCallback, false);

      let closedPoller = setInterval(() => {
        dialogflowWindow.eval(
          `window.opener.postMessage(document.cookie, "*")`
        );

        if (dialogflowWindow.closed) {
          console.log(dialogflowCookies);
          this.dialogflowCookies = dialogflowCookies;
          this.bearerToken = this.extractBearerToken(dialogflowCookies);
          this.requestLogs(dialogflowCookies, this.bearerToken);
          window.removeEventListener("message", windowMessageCallback, false);
          clearInterval(closedPoller);
        }
      }, 100);
    },
    changePage(nextPage) {
      if (!this.bearerToken) return;

      if (nextPage) {
        this.pageTokens.push(this.logs.nextPageToken);
        this.pageIndex++;
      } else if (this.pageIndex >= 1) {
        this.pageIndex--;
      }
      this.requestLogs(this.dialogflowCookies, this.bearerToken);
    },
    /**
     * @param {String} cookies
     */
    extractBearerToken(cookies) {
      return cookies.match(/currentAgentId[^=;]+=%22([^;]+)%22/)[1];
    },
    exportJson() {
      writeFile("leonie_logs.json", JSON.stringify(this.logs), "utf8", () => {
        alert("Exported logs!");
      });
    },
    /**
     * @param {String} toHighlight
     */
    highlightText(toHighlight) {
      if (!this.filterText) return toHighlight;
      if (!toHighlight) return "";

      return toHighlight.replace(
        this.filterText,
        `<span class="highlight">${this.filterText}</span>`
      );
    },
    async requestLogs(cookies, bearerToken) {
      let appendix = "";
      if (this.pageIndex > 0)
        appendix = `&pageToken=${this.logs.nextPageToken}`;
      let apiURL = `https://api.dialogflow.com/api/interactions/conversations2?startTimeMillis=0&endTimeMillis=${Date.now()}&conversationsPerPage=200&interactionsPerConversation=25&matchedToIntent=true&searchBackward=false${appendix}`;
      console.log(apiURL);

      console.log({
        Cookie: cookies,
        Authorization: `Bearer ${bearerToken}`,
        ...this.googleHeaders
      });

      let response = await fetch(apiURL, {
        method: "get",
        headers: new Headers({
          Cookie: cookies,
          Authorization: `Bearer ${bearerToken}`,
          ...this.googleHeaders
        }),
        credentials: "include",
        mode: "cors"
      });

      this.displayLogs(await response.json());
    },
    /**
     *
     * @param {{conversations: {conversationId: number, interactions:{id: string, conversationResponse:{queryText:string, timestamp: string, fulfillmentMessages:{text:{text:string[]}}[]}}[]}[]}} logs
     */
    displayLogs(logs) {
      // Get the conversationText
      logs.conversations.forEach(c =>
        c.interactions.forEach(
          interaction =>
            (interaction.conversationResponse.conversationText = this.getText(
              interaction.conversationResponse
            ))
        )
      );
      this.logs = logs;
    },
    getText(conversationResponse) {
      if (!conversationResponse) return;

      let fulfillmentMessages = conversationResponse.fulfillmentMessages;
      if (!fulfillmentMessages || !fulfillmentMessages[0].payload) return;
      let jsonResponse = fulfillmentMessages[0].payload;


      let text = "";
      if (jsonResponse.content.text) {
        text = jsonResponse.content.text;
      } else {
        text = `<pre><code> ${this.escapeHtml(
          JSON.stringify(jsonResponse, null, " ")
        )} <pre><code>`;
      }

      return text;
    },
    /**
     *
     * @param {String} unsafe
     */
    escapeHtml(unsafe) {
      return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "\\&#039;");
    }
  }
};
</script>



<style>
@import url("https://fonts.googleapis.com/css?family=Source+Sans+Pro");
@import "~vue-virtual-scroller/dist/vue-virtual-scroller.css";

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: "Source Sans Pro", sans-serif;
}

#wrapper {
  /* background: radial-gradient(
    ellipse at top left,
    rgba(255, 255, 255, 1) 40%,
    rgba(229, 229, 229, 0.9) 100%
  );
  height: 100vh;
  width: 100vw;*/
  padding: 60px 80px;
}

.title {
  color: #2c3e50;
  font-size: 20px;
  font-weight: bold;
  margin-bottom: 6px;
  display: flex;
}

button {
  font-size: 0.8em;
  cursor: pointer;
  outline: none;
  padding: 0.75em 2em;
  border-radius: 2em;
  display: inline-block;
  color: #fff;
  background-color: #4fc08d;
  transition: all 0.15s ease;
  box-sizing: border-box;
  border: 1px solid #4fc08d;
}
.small-text {
  font-size: 0.6em;
  color: grey;
  line-height: 2em;
}

.title .small-text {
  transition: font-size 0.5s;
}
.title:hover .small-text {
  font-size: 1em;
  line-height: initial;
}
.conversation-container {
  padding-bottom: 20px;
}
.conversation {
  border: 2px solid darkgrey;
  border-radius: 8px;
  overflow: hidden;
}

.interaction:nth-child(odd) {
  background-color: rgb(240, 240, 240);
}
.interaction:nth-child(even) {
  background-color: white;
}
.guest-text {
  background-color: rgba(255, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1em;
}
.leonie-text-container {
  max-height: 7em;
  overflow-y: auto;
}
.timestamp {
  font-size: 0.8em;
  color: rgb(90, 90, 90);
}

.bottom-bar {
  position: fixed;
  bottom: 0px;
  left: 0px;
  right: 0px;
  height: 3.5em;
  border-top: 1px solid lightgrey;
  display: flex;
  justify-content: space-between;
  padding: 0.5em;
  background-color: white;
}
input[type="text"] {
  width: 30em;
}
.highlight {
  background-color: gold;
}
.scroller {
  height: 100%;
}
</style>
