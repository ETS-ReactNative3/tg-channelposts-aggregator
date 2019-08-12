const getUrls = require('get-urls')
const cleanMark = require('clean-mark')
const UdemyCrawler = require('./crawler')
const UrlCrawler = require('./urlParser')
const mongoose = require('mongoose')
const Post = mongoose.model('Post')
// const nodeMercuryParser = require('node-mercury-parser')
// nodeMercuryParser.init(process.env.MERCURY_PARSER_KEY)

const parseAndSaveCourse = (url, courseId = null) => {
  setTimeout(() => {
    // delay the next call to the third-party api
    prepareUdemyCourseJSON(url, courseId)
      .then(contents => {
        if (contents) {
          let contentsSaved

          contentsSaved = populateUdemyCourseDate(contents)

          setTimeout(() => {
            console.log(getFullDate() + ' contentsSaved ', contentsSaved)
          }, 1000)
        } else {
          console.error(
            getFullDate() + ' ADD_POST: contents were not parsed yet.'
          )
          // exit on: "Udemy page response of 403" or other status than 200
          throw 'Error connecting to the course platform.'
        }
      })
      .catch(err =>
        console.error(getFullDate() + ' ADD_POST prepareUdemyCourseJSON: ', err)
      )
  }, 3750)
}

const isAlreadyInDB = cleanedUrl => {
  // exit on duplicates
  if (cleanedUrl !== 0) {
    let isInDB = true
    return Post.findOne(
      { 'preview.courseUrl': { $regex: cleanedUrl, $options: 'i' } },
      async (err, response) => {
        if (response !== null) {
          console.warn(
            getFullDate() +
              ' This post was already added to DB before. Aborting.',
            cleanedUrl
          )
          isInDB = true
          console.log(getFullDate() + ' isAlreadyInDB', isInDB)
          return isInDB
          // throw new Error('This post was already added to DB before. Aborting.')
        } else {
          if (err) {
            console.error(getFullDate() + ' DB query error', err)
          }
          isInDB = false
          console.log(getFullDate() + ' isAlreadyInDB', isInDB)
          return isInDB
        }
      }
    )
    // return isInDB
  }
  console.error(getFullDate() + ' URL is invalid')
  return false
}

// for logging purposes
const getFullDate = (d = new Date()) => {
  const date = d // typeof d === 'string' ? new Date(d) : d
  const dd = date.getUTCDate()
  let mm = date.getUTCMonth() + 1
  mm = mm < 10 ? `0${mm}` : mm
  const yyyy = date.getUTCFullYear()
  let hh = date.getUTCHours() + 2
  hh = hh.toString().length < 2 ? `0${hh}` : hh
  let min = date.getUTCMinutes()
  min = min.toString().length < 2 ? `0${min}` : min
  let sec = date.getUTCSeconds()
  sec = sec.toString().length < 2 ? `0${sec}` : sec
  let msec = date.getUTCMilliseconds()
  msec =
    msec.toString().length > 1 && msec.toString().length < 3
      ? `0${msec}`
      : msec.toString().length < 2
      ? `00${msec}`
      : msec
  const fullDate = `${dd}.${mm}.${yyyy} at ${hh}:${min}:${sec}:${msec}`
  return fullDate
}

const parseUrl = async (url, paths = ['body a']) => {
  console.log(
    getFullDate() + ' parseUrl: parsing of the link from the third-party site',
    'Starting...'
  )
  const urlParser = new UrlCrawler()
  return urlParser.execute(url, paths)
}

const prepareUdemyCourseJSON = async (url, courseId) => {
  const crawler = new UdemyCrawler('', courseId)
  console.log(getFullDate() + ' prepareUdemyCourseJSON Crawling', 'Starting...')
  return crawler.execute(url, (err, content) => {
    if (err) {
      return console.error(err.message)
    }
    // console.log(content)
    console.log(
      getFullDate() + ' prepareUdemyCourseJSON Crawling: Finished...👍'
    )
    return content
  })
}

const populateUdemyCourseDate = async contents => {
  console.log(getFullDate() + ' populateUdemyCourseDate ', 'Starting...')
  const NewPost = new Post()
  NewPost.preview.courseContents = {}
  NewPost.preview.courseId = contents.id
  NewPost.preview.courseUrl = contents.url
  NewPost.preview.courseContents.text = contents.description
  NewPost.preview.courseContents.audiences = contents.audiences
  NewPost.preview.courseContents.author = contents.authors
  NewPost.preview.courseContents.date = contents.date
  NewPost.preview.courseContents.discountInPercent = contents.discount
  NewPost.preview.courseContents.discountExpirationDate =
    contents.discountExpiration
  NewPost.preview.courseContents.currentPrice = contents.price
  NewPost.preview.courseContents.initialPrice = contents.fullPrice
  NewPost.preview.courseContents.title = contents.title
  NewPost.preview.courseContents.headline = contents.headline
  NewPost.preview.courseContents.enrolled = contents.enrollmentNumber
  NewPost.preview.courseContents.rating = contents.rating
  NewPost.preview.courseContents.lectures = contents.curriculum
  NewPost.preview.courseContents.keywords = contents.topics.join(', ')
  NewPost.preview.courseContents.url = contents.image

  // save post only if the given url is valid and the contents were properly parsed
  const postStatus = NewPost.save().then(post => {
    return post
      ? getFullDate() +
          ` ADD_POST: course contents saved! 👍 POST ID: ${post._id}`
      : getFullDate() + ' ADD_POST: contents couldn’t be saved into DB: ' + post
  })
  return postStatus
}

const extractTags = text => {
  if (!text) return ['untagged']
  const extractedTags = text.match(/\[(.*?)\]/g) // ['[Design]', '[Code]', ...]
  const tags =
    extractedTags &&
    extractedTags.map(t => t.replace(/[\[ | \]]/g, '').toLowerCase()) // ['design', 'code', ...]
  return tags.length > 0 ? tags : ['untagged']
}

const extractClutter = text => {
  const filteredString = text.replace(/@multifeed_edge_bot/g, '')
  return filteredString
}

const extractHashtags = text => {
  if (!text) return ['untagged']
  const extractedTags = text.match(/\#(.*?)\ /g) // ['#tag ', '#foo ']
  const tags = extractedTags && extractedTags.map(t => t.replace(/[# ]/g, ''))
  if (tags) return tags.length > 0 ? tags : ['untagged']
  return ['untagged']
}

const replaceAll = (originalString, findRegExp, replace) => {
  return originalString.replace(new RegExp(findRegExp, 'g'), replace)
}

const extractUrl = text => {
  // https://github.com/sindresorhus/normalize-url#options
  const urlSet = getUrls(text, { stripWWW: false })
  const urlArr = Array.from(urlSet)
  let offset = 4
  if (urlArr[0]) {
    let rightPartOfUrlPosition = urlArr[0].search(/.com/gm)

    // fix urls with '.com' ending only
    if (rightPartOfUrlPosition !== -1) {
      const leftPart = urlArr[0].substr(0, rightPartOfUrlPosition + offset)
      const rightPart = urlArr[0].substr(rightPartOfUrlPosition + offset)
      return `${leftPart}${replaceAll(rightPart, /\./, '')}`
    }
    return urlArr[0]
  }
  return ''
}

const preparePreviewMark = async url => {
  return cleanMark(url, {})
}

const isAd = text => {
  if (text.match(/@RegularPromos/gi) || text.match(/@Black Promotions/gi)) {
    return true
  }
  return false
}

exports.getFullDate = getFullDate
exports.extractTags = extractTags
exports.extractHashtags = extractHashtags
exports.extractClutter = extractClutter
exports.extractUrl = extractUrl
exports.preparePreviewMark = preparePreviewMark
exports.prepareUdemyCourseJSON = prepareUdemyCourseJSON
exports.populateUdemyCourseDate = populateUdemyCourseDate
exports.parseUrl = parseUrl
exports.isAd = isAd
exports.replaceAll = replaceAll
exports.isAlreadyInDB = isAlreadyInDB
exports.parseAndSaveCourse = parseAndSaveCourse
