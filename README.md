# Telegram channels' posts aggregator

🚧 ...Work in progress... 🚧

📩 📭 Aggregates posts from your telegram channel(s) assigned to your bot(s), filters the data, saves it into MongoDB & renders the data using React (see the **client** folder).

# Features & Technologies 💡

- [telegraf.js](https://telegraf.js.org/#/?id=features)
- [cheerio](https://www.npmjs.com/package/cheerio)
- [sync-request](https://www.npmjs.com/package/sync-request) but consider [then-request](https://github.com/then/then-request)
- [normalize-url](https://www.npmjs.com/package/normalize-url)
- @multifeed_edge_bot to aggregate and [redirect](https://github.com/galakhov/tg-channelposts-aggregator/tree/master/server) messages from a set of channels
- [ElasticSearch](https://www.elastic.co)
- [monstache](https://rwynn.github.io/monstache-site/)
- Docker Hub Registry
- Drone.io: CI/CD Tool
- Telegram

# Installation

See [server/README.md](server/README.md) & [client/README.md](client/README.md) files for the detailed installation steps.

# The big picture of CI/CD

<img src="./_manual/images/05-Deployment.jpg" alt="CI and the architecture" width="700">
<sub><strong>Figure 1. CI/CD step-by-step.</strong></sub>

## The Setup

My set-up is a healthy combination of the containers arranged into a [Docker Swarm Stack](https://docs.docker.com/engine/swarm/), the Docker Hub Registry's with [automated builds](https://docs.docker.com/docker-hub/builds/), [Traefik (v2)](https://docs.traefik.io) and the self-hosted lightweight container-native CI/CD platform called [Drone.io](https://drone.io) with couple of [plugins](http://plugins.drone.io).

The set-up is somewhat similar to the one presented in this [post](https://habr.com/ru/post/476368/), The post outlines a CI/CD pipeline entirely based on [GitHub Actions](https://github.com/features/actions) and on some bash scripts, executed via SSH on a VPS. Besides the redundant configuration of the Docker Hub's secrets and the recurring logins to Docker Hub, author [hard-codes](https://github.com/dementevda/actions_ci_example/blob/master/.github/workflows/pub_on_release.yaml) a deployment webhook in the `deploy` step of the pipeline, i.e. a _curl_ POST request to his own custom endpoint. His solution is a bit over-engineered, though, it allows to control things manually, and useful if you plan to stick to GitHub Actions.

If you connect your Docker Hub account with a GitHub repository you actually don't need to configure any additional secrets in GitHub, nor use any GitHub Actions or any commands to build & push your containers (**step 5** in the _Figure 1_). With a pre-configured _automated build_ for each stack (or even for each microservice), Docker Hub Registry (re-)builds and (re-)places the required containers by itself, provided there was a push event (**step 1**).

For instance, I have two containers in the current GitHub repository with the corresponding Dockerfiles for the frontend and for the backend: `./client/Dockerfile.prod` and `./server/Dockerfile.prod`. The configuration of the frontend's container is shown in the image below:

<img src="./_manual/images/02 Docker Hub — Automated Frontend Builds Configuration (Dockerfile in Production).jpg" width="1024" alt="Automated Frontend Configuration of the Docker Build">
<sub><strong>Figure 2. Automated docker build: frontend container's configuration.</strong></sub>

<br />
<br />
These two containers are (re-)built and saved in the Docker Hub Registry every time I push new changes to my repository.
<br />
<br />

> To avoid any mis-configuration, it's recommended to verify the GitHub's Webhooks (https://github.com/{github-user}/{github-repo}/settings/hooks), which are being added by Docker Hub, after the set-up of the automated build(s) in the Docker Account: https://hub.docker.com/repository/docker/{organisation-name}/{repo-name}/builds/edit.

As for the (re-)deployment (**step 8**), the [Drone CI/CD tool](https://docs.drone.io) is responsible for it as well as for the notification about the build's status (**step 9**) at least in the pipeline of this repo. The new Docker containers are pulled (**step 7**) and the Docker Swarm Stack is updated after the [execution of one single command](https://github.com/galakhov/tg-channelposts-aggregator/blob/dockerized/.drone.yml#L66) in the end via the [Drone SSH plugin](http://plugins.drone.io/appleboy/drone-ssh/) on a VPS:

```bash
docker stack deploy -c /path/to/docker-compose-stack-file.yml {stack-name}
```

It is always possible to update services in a stack one after another, [applying the rolling update](https://docs.docker.com/engine/swarm/swarm-tutorial/rolling-update/) to each microservice separately:

```bash
docker service update {SERVICE-NAME}
```

<br />

### Drone.io insights

#### Docker Hub's outgoing Webhooks can be received by Drone CI/CD

The **step 6** of the _Figure 1_ is all about Docker Hub Webhooks that are ["(...) POST requests sent to a URL you define in Docker Hub"](https://docs.docker.com/docker-hub/webhooks/) by default. This way one can notify the Drone CI/CD (or any other platform) that the containers were built, you can set up the webhook in Docker Hub in one of your repositories, preferably in the repository that's built last of all:

```bash
https://hub.docker.com/repository/docker/{organisation-name}/{repo-name}/webhooks
```

The Webhook's name is not important, but the Webhook URL is crucial and is explained in detail in the next section.

#### Which Docker Hub's Webhook URLs are valid to use with the Drone.io's API?

To process an external call I use the built-in [Drone.io's REST API endpoint](https://docs.drone.io/api/overview/), which receives GET, POST, DELETE and other external requests.

Accessing the endpoint, you can, for instance, view the list of the recent deployments (the _deployments_ in the Drone CI/CD platform are called _builds_) in one of your repositories by sending the following **GET** request using _curl_ or just by opening this page in your browser:

```bash
http://YOUR_IP_OR_DNS:PORT/api/repos/{github-owner}/{repo-name}/builds
```

I'm not doing any tests nor am I building & pushing any containers, as they were already built by Docker Hub. Though, in my case I need to trigger the pipeline and start a new deployment process (Drone's _build_), which will then pull all the newly built containers from Docker Hub and deploy them to Swarm.

To trigger the `deploy` step in the [pipeline](./.drone.yml#L20), a new build needs to be [invoked](https://docs.drone.io/api/builds/build_create/) with the `custom` (or `promote`) [drone event type](https://docs.drone.io/pipeline/triggers/#by-event). Consequently, a new build with the corresponding listing of the pipeline commands is _limited_ to the execution of the `deploy` step, [as it's stated by the Drone developers](https://docs.drone.io/pipeline/triggers/). In fact, the execution isn't _limited_ to just one step, but runs the pipeline, starting from [this step](./.drone.yml#L20) with the `custom` event, then executes all the subsequent steps. In this way the deployment is triggered by Drone CI/CD after the webhook from Docker Hub was received by the Drone's API endpoint as the valid **POST** request:

```bash
POST http://YOUR_IP_OR_DNS:PORT/api/repos/{github-owner}/{repo-name}/builds?branch={branch-in-the-repo-with-the-drone-yml-pipeline-file}
```

It would have been enough if the API endpoint were public. The part on how to accomplish an authorized POST request without curl and the part about _/builds_ parameters are so far (March, 2020) quite badly documented. By the way, the personal bearer authorization token generated by Drone.io itself can be found in the account settings: http://YOUR_IP_OR_DNS:PORT/account.

In the Docker Hub there is currently no way to send POST requests with parameters like you would do it on [reqbin.com](https://reqbin.com) as well as with an option to provide a type of authorization, etc. So what does the Webhook URL should look like to be the valid request that satisfies the Drone.io API endpoint?

It turns out, you can send an authorized POST request by passing over the **?access_token=** parameter that, among [other parameters](https://github.com/drone/drone/issues/2679), is being [validated during the creation of a build](https://github.com/drone/drone/blob/3fcbf1c78f44c4b592d17b009982578215994bd1/handler/api/repos/builds/create.go#L91). The final _Webhook URL_, triggering a new build, is then should look like this:

```bash
http://YOUR_IP_OR_DNS:PORT/api/repos/{github-owner}/{repo-name}/builds?branch={branch-in-the-repo-with-the-drone-yml-pipeline-file}&access_token={authorization-token}
```

You can omit the `branch` parameter and use the default GitHub's repo branch instead.

<br />
<br />

## Posts with the similar setups I was inspired by:

- [Setup Gitea and Drone on Docker 2020 Edition](https://blog.ruanbekker.com/blog/2020/02/04/setup-gitea-and-drone-on-docker-2020-edition/) / [Source code 1](https://gist.github.com/ruanbekker/27d2cb2e3f4194ee5cfe2bcdc9c4bf52) / [Source code 2](https://gist.github.com/ruanbekker/3847bbf1b961efc568b93ccbf5c6f9f6)
- [Using Drone CI/CD to Build a Jekyll Site and Deploy to Docker Swarm](https://blog.ruanbekker.com/blog/2019/04/23/using-drone-ci-to-build-a-jekyll-site-and-deploy-to-docker-swarm/)
- [Setup a Drone CI/CD Environment on Docker With Letsencrypt](https://blog.ruanbekker.com/blog/2019/04/18/setup-a-drone-cicd-environment-on-docker-with-letsencrypt/)
- [Self Hosted Git and CI/CD Platform with Gitea and Drone on Docker](https://sysadmins.co.za/self-hosted-git-and-cicd-platform-with-gitea-and-drone-on-docker/)

### Posts on Docker Swarm Clusters

[Create a Docker Swarm Cluster on DigitalOcean](https://lunar.computer/posts/docker-swarm-digitalocean/)

### Posts on Traefik v2

[Traefik v2 with the static and dynamic configuration](https://dev.to/nflamel/how-to-have-https-on-development-with-docker-traefik-v2-and-mkcert-2jh3)

### Other Drone.io sources

Sample of a [.drone.yml configuration](https://gist.github.com/anson-vandoren/03234a231e9af533aa0bad9ff2d2b58f) file.

Docs of the Drone [plugin that executes commands on a remote server via SSH](http://plugins.drone.io/appleboy/drone-ssh/) / [Drone SSH on GitHub](https://github.com/appleboy/drone-ssh):

- [How to set environment variables for a drone plugin](https://github.com/appleboy/drone-ssh/issues/130)
- [Undocumented Drone SSH environment variables](https://github.com/appleboy/drone-ssh/blob/master/main.go#L35)
- [Drone SSH: usage example](https://git.b12f.io/hornet.garden/hornet.garden/src/commit/afe6557279ddc9b53c2be882797bae36ea185d08/.drone.yml?lang=lv-LV)

[The Drone Telegram Plugin](http://plugins.drone.io/appleboy/drone-telegram/) to send notifications of the build status to a chat in Telegram:

- [Get the token by creating and starting your bot](https://angristan.xyz/2018/08/setup-telegram-bot-for-drone-ci-cd-builds/)
- Chat ID for the 'to' parameter can be obtained by starting the @userinfobot or @get_id_bot in Telegram.

<br />

# Credits 🙏

Inspired by and based on this [repo](https://github.com/foreseaz/tg-channel-dashboard).
