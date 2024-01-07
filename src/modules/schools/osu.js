'use strict';

/**
 * Get credit of a course
 * @param {object} info
 * @param {function} callback callback function to return credit
 * @param {function} fallback when course not found
 */
function getCredit(info, callback, fallback) {
  // au2023=1238. Let’s break that down.
  // 1  – Century marker. 0 = 1900, 1 = 2000
  // 23 – Year in the century (i.e. 2023)
  // 8 – Autumn semester. Spring = 2, Summer = 4, Autumn = 8
  // from https://u.osu.edu/wade.199/2023/09/06/terms-on-my-own-terms/
  var term_code =
    info.century.toString() +
    info.year.toString() +
    (info.semester == 'Autumn' ? '8' : info.semester == 'Spring' ? '2' : '4');
  var searh_url = `https://contenttest.osu.edu/v2/classes/search?q=${info.class_name}&client=json&campus=${info.campus}&p=1&term=${term_code}`;
  fetch(searh_url)
    .then((resp) => resp.json())
    .then((json) => {
      for (var c of json.data.courses) {
        var course = c.course;
        if (`${course.subject} ${course.catalogNumber}` == info.class_name) {
          if (course.maxUnits != course.minUnits) {
            console.warn(
              `Course ${info.class_name} has multiple credit options. Please check manually.`
            );
          }
          if (
            c.sections.some((section) => section.classNumber == info.section)
          ) {
            callback(course.maxUnits);
            return;
          } else {
            console.warn(
              `Course ${info.class_name} does not have section ${info.section}. Please check manually.`
            );
          }
        }
      }
      console.warn(
        `Course ${info.class_name} not found. Please check manually.`
      );
      fallback();
    });
}

module.exports.getCredit = getCredit;
