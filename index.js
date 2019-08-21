require('dotenv').config();
const axios = require("axios");

const client = axios.create({
    baseURL: "https://circleci.com/api/v1.1/",
    timeout: 10000
});

const debug = process.env.DEBUG;
const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
const cronMin = parseInt(process.env.CRON_MIN);

let notifyJobs = [];

exports.handler = (event, context) => {
    client.get("project/github/shikorism/tissue/tree/develop", {
        params: {
            shallow: true,
            limit: 30
        }
    })
        .then(res => res.data)
        .then(data => {
            const currentTimestamp = parseInt(new Date().getTime() / 1000);
            data.forEach(job => {
                // ジョブが終了していてスケジュールなら
                if (job.stop_time && job.workflows.workflow_name === "scheduled_resolver_test") {
                    const jobTimestamp = parseInt(Date.parse(job.stop_time) / 1000);
                    // 終了時間がcronMin分以内なら
                    if (currentTimestamp - jobTimestamp <= cronMin * 60 || debug) {
                        notifyJobs.push(job);
                    }
                }
            });
        })
        .catch(err => {
            console.error(err);
        })
        .finally(() => {
            if (notifyJobs.length) {
                let embeds = [];
                notifyJobs.forEach(job => {
                    const isSuccess = job.status === "success" ? true : false;
                    const url = job.build_url;
                    const jobName = job.workflows.job_name;
                    const buildNum = job.build_num;
                    const buildSec = parseInt(job.build_time_millis / 1000);
                    embeds.push({
                        title: `#${buildNum} ${jobName}`,
                        url: url,
                        fields: [
                            {
                                name: "ステータス",
                                value: isSuccess ? "✅" : "🚫",
                                inline: true
                            },
                            {
                                name: "所要時間",
                                value: `${buildSec}sec`,
                                inline: true
                            }
                        ]
                    });
                })
                axios.post(webhookUrl, {
                    username: "CircleCI Watcher",
                    content: "スケジュールジョブが完了しました。",
                    embeds: embeds
                });
            }
        });
}
