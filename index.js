'use strict';

const line = require('@line/bot-sdk');
const express = require('express');
const path = require('path');
const fs = require('fs');
const config = {
  channelAccessToken: '',
  channelSecret: '',
};


const client = new line.Client(config);
const app = express();
const words  = require('./words.json');

let echo = { type: 'text', text: '請從選單進行操作 ⬇️' };

app.get('/', (req, res) => {
  let html = `<html>
    <head>
      <title>高中7000單</title>
      <script>window.location = "https://line.me/R/ti/p/@323geiqw";</script>
    </head>
    <body style="text-align:center">
      <h1>自動跳轉中⋯⋯</h1>
    </body>
  </html>`;

  res.send(html);
});

app.post('/callback', line.middleware(config), (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

app.on('postback', function (event) {
  console.log(event);
});

function handleEvent(event) {
  if (event.type !== 'message' || event.type !== 'postback')
  {
    switch (event.type) {
      case 'message':
        handleMessageEvent(event);
        break;
      case 'postback':
        handlePostbackEvent(event);
        break;
      default:
        return client.replyMessage(event.replyToken, echo);
    }
  }
  else {
    // ignore non-text-message event
    return Promise.resolve(null);
  }
}

function handleMessageEvent(event) {
  switch (event.message.text) {
    case '開始測驗':
      let question_json = createQuestion();
      return client.replyMessage(event.replyToken, [question_json]);
      break;
    case '得分':
      return handleUserPoints(event);
      break;
    default:
      return client.replyMessage(event.replyToken, echo);
  }
}

function handlePostbackEvent(event) {
  const postback_result = handleUrlParams(event.postback.data);
  switch (postback_result.type) {
    case 'answer':
      let answer_result = handleAnswer(event.postback.data)
      if (answer_result) {
        updateUserPoints(event);
        return client.replyMessage(event.replyToken, moreQuestion(postback_result.wid));
      }
      else {
        echo = { type: "text", text: "答錯了" };
        return client.replyMessage(event.replyToken, echo);
      }
      break;
    case 'more_question':
      let more_question_json = createQuestion(postback_result.wid);
      return client.replyMessage(event.replyToken, [more_question_json]);
      break;
    case 'more_test':
      let question_json = createQuestion();
      return client.replyMessage(event.replyToken, [question_json]);
      break;
    default:
      return client.replyMessage(event.replyToken, echo);
  }
}

function handleUrlParams(data) {
  const params = new URLSearchParams(data);
  const wid = params.get('wid');
  const type = params.get('type');
  const content = params.get('content');
  return {'wid': wid, 'type': type, 'content': content};
}

function createQuestion(current_wid = null) {
  let new_words = words;

  if (current_wid !== null) {
    let index = words.findIndex(function(x){
      return x.id === parseInt(current_wid);
    })
    if (index !== -1) new_words = removeByIndex(new_words, index);
  }

  let w = new_words[Math.floor(Math.random() * new_words.length)];
  let contents = [];
  let w_text = {
    "type": "text",
    "text": `${w.word}\n`,
    "wrap": true
  };

  contents.push(w_text);

  let answers = createAnswers(w.id);
  answers.push(w);

  let shuffled_answers = answers.sort(function () {
    return Math.random() - 0.5;
  });

  for (let i = 0; i < answers.length; i++) {
    contents.push({
      "type": "button",
      "action": {
        "type": "postback",
        "label": answers[i].translate,
        "displayText": answers[i].translate,
        "data": `wid=${w.id}&type=answer&content=${answers[i].translate}`
      },
      "style": "secondary",
      "adjustMode": "shrink-to-fit"
    });
  }

  return {
    "type": "flex",
    "altText": "考試開始，不要作弊！",
    "contents": {
      "type": "bubble",
      "body": {
        "type": "box",
        "layout": "vertical",
        "spacing": "md",
        "contents": contents
      }
    }
  };
}

function createAnswers(wid, total = 3) {
  let object = [];

  let new_words = words;
  let index = words.findIndex(function(x){
    return x.id === parseInt(wid);
  })
  if (index !== -1) new_words = removeByIndex(new_words, index);

  let array_container = [];
  const gen_numbers = Math.floor(Math.random() * new_words.length);
  array_container.push(gen_numbers);

  for (let counter = 0; counter < (new_words.length - 1) && array_container.length < total; counter++) {
    let new_gen = Math.floor(Math.random() * new_words.length);
    while (array_container.lastIndexOf(new_gen) !== -1) {
      new_gen = Math.floor(Math.random() * new_words.length);
    }
    array_container.push(new_gen);
  }

  for (let i = 0; i < total; i++) {
    object.push(new_words[array_container[i]]);
  }

  return object;
}

function moreQuestion(wid) {
  return {
    "type": "flex",
    "altText": "再來一題",
    "contents": {
      "type": "bubble",
      "body": {
        "type": "box",
        "layout": "vertical",
        "spacing": "md",
        "contents": [
          {
            "type": "text",
            "text": "恭喜、答對了！！！\n"
          },
          {
            "type": "button",
            "action": {
              "type": "postback",
              "label": "再來一題",
              "displayText": "再來一題",
              "data": `wid=${wid}&type=more_question&content=再來一題`
            },
            "style": "primary"
          }
        ]
      }
    }
  }
}

function handleAnswer(data) {
  let result = handleUrlParams(data);
  let w = words.filter(x => x.id == result.wid);
  return result.content == w[0].translate ? true : false;
}

function handleUserPoints(event) {
  let user = event.source.userId;
  let path = `./users/${user}.json`;
  let user_json = `[{"user": "${user}", "point": 0}]`;

  if (fs.existsSync(path)) {
    fs.readFile(path, function (error, data) {
      if (error) throw error;
      else {
        let current_json = JSON.parse(data)
        return client.replyMessage(event.replyToken, createPointMessage(current_json[0].point));
      }
    });
  }
  else {
    fs.writeFile(path, user_json, function (error, data) {
      if (error) {
        console.error(error);
      }
    });

    echo = { type: "text", text: "零分啦！" };
    return client.replyMessage(event.replyToken, echo);
  }
}

function createPointMessage(point, wid) {
  let gold_stars = 1;

  if (point >= 2500) gold_stars = 5;
  else if (point >= 1000) gold_stars = 4;
  else if (point >= 500) gold_stars = 3;
  else if (point >= 100) gold_stars = 2;
  else gold_stars = 1;

  let stars_contents = [];
  for (let i = 0; i < gold_stars; i++) {
    stars_contents.push({
      "type": "icon",
      "size": "sm",
      "url": "https://scdn.line-apps.com/n/channel_devcenter/img/fx/review_gold_star_28.png"
    });
  }

  for (let j = 0; stars_contents.length < 5; j++) {
    stars_contents.push({
      "type": "icon",
      "size": "sm",
      "url": "https://scdn.line-apps.com/n/channel_devcenter/img/fx/review_gray_star_28.png"
    });
  }

  return {
    "type": "flex",
    "altText": "你的分數",
    "contents": {
      "type": "bubble",
      "header": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "image",
            "url": "https://cdn2.ettoday.net/images/5588/5588832.jpg",
            "flex": 1,
            "size": "full",
            "aspectRatio": "2:1",
            "aspectMode": "cover"
          }
        ],
        "paddingAll": "0px"
      },
      "body": {
        "type": "box",
        "layout": "vertical",
        "spacing": "md",
        "contents": [
          {
            "type": "text",
            "text": `你目前的得分為：${point}分\n\n`
          },
          {
            "type": "box",
            "layout": "baseline",
            "margin": "md",
            "contents": stars_contents
          },
          {
            "type": "button",
            "action": {
              "type": "postback",
              "label": "繼續測驗",
              "displayText": "繼續測驗",
              "data": `type=more_test&content=繼續測驗`
            },
            "style": "primary"
          }
        ]
      }
    }
  };
}

function updateUserPoints(event) {
  let user = event.source.userId;
  let path = __dirname + `/users/${user}.json`;
  let user_json = '';

  if (fs.existsSync(path)) {
    fs.readFile(path, function (error, data) {
      if (error) throw error;
      else {
        let old_json = JSON.parse(data)
        let point = old_json[0].point + 1;
        user_json = `[{"user": "${user}", "point": ${point}}]`
        fs.writeFile(path, user_json, function (error, data) {
          if (error) throw error;
        });
      }
    });
  }
  else {
    user_json = `[{"user": "${user}", "point": 1}]`
    fs.writeFile(path, user_json, function (error, data) {
      if (error) throw error;
    });
  }
}

function removeByIndex(array, index) {
  return array.filter(function (el, i) {
    return index !== i;
  });
}

// listen on port
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`listening on ${port}`);
});
