import React from 'react'

import _format from 'date-fns/format'
import styles from './Card.css'

const createMarkup = text => {
  return { __html: text }
}

let tagsArray

const Card = ({
  _id,
  onCardClick,
  createdDate,
  rating,
  studentsEnrolled,
  expirationDate,
  discount,
  listPrice,
  img,
  text,
  headline,
  tags,
  nr
}) => {
  if (tags && typeof tags === 'string') {
    tagsArray = tags.split(', ')
  } else {
    tagsArray = tags
  }

  const discounted = discount !== null ? `${discount}% OFF` : ''

  const expiration =
    expirationDate !== null
      ? `Coupon code is valid until ${_format(
        new Date(expirationDate),
        'DD.MM.YYYY HH:mm'
      )}`
      : ''
  const freeCourse =
    listPrice === 0
      ? 'FREE'
      : listPrice !== undefined
        ? `Coupon expired: ${listPrice}€`
        : ''

  const addedOnDate = createdDate
    ? `Coupon added on ${_format(new Date(createdDate), 'DD.MM.YYYY HH:mm')}`
    : ''

  const courseRating =
    rating !== null ? (rating.length > 3 ? rating.substr(0, 3) : rating) : null
  const courseStudentsNr = studentsEnrolled !== null ? studentsEnrolled : null

  return (
    <div className={styles.card} onClick={() => onCardClick(_id)}>
      {img && (
        <div className={styles.leadImg}>
          <img src={img} alt="lead-img" />
        </div>
      )}
      <div className={styles.breadcrumbs}>
        {expirationDate !== null && (
          <div className={styles.expirationDate}>
            <div className={styles.couponOff}>{discounted}</div> {expiration}
          </div>
        )}
        {expirationDate === null && (
          <div className={styles.expirationDate}>
            <div className={styles.couponOff}>{freeCourse}</div>
          </div>
        )}
        <div className={styles.courseStats}>
          {courseStudentsNr !== null && (
            <div className={styles.courseStudents}>
              {courseStudentsNr.replace(' students enrolled', '')}
            </div>
          )}
          {courseRating !== null && courseRating !== '0.0' && (
            <div className={styles.courseRating}>Rating: {courseRating}/5</div>
          )}
        </div>
      </div>
      <div
        className={styles.main}
        dangerouslySetInnerHTML={createMarkup(`<h2>${text}</h2>`)}
      />
      <div
        className={styles.headline}
        dangerouslySetInnerHTML={createMarkup(`<h3>${headline}</h3>`)}
      />

      <ul className={styles.tags}>
        {tagsArray &&
          tagsArray.map((tag, idx) =>
            tag !== 'untagged' ? (
              tagsArray.length === idx + 1 ? (
                <li key={idx}>{`${tag}`}</li>
              ) : (
                <li className={styles.nextTag} key={idx}>{`${tag}, `}</li>
              )
            ) : (
              ''
            )
          )}
      </ul>
      <div className={styles.addedDate}>{addedOnDate}</div>
      <div className={styles.cardNumber}>
        <p>{nr + 1 ? `- ${nr + 1} -` : ''}</p>
      </div>
    </div>
  )
}
export default Card
