'use strict';

console.log('> OSU Web Toolbox active! <');

const enableModules = {
  get: (cb) => {
    chrome.storage.local.get([`enableModules`], (result) => {
      cb(result[`enableModules`]);
    });
  },
};

function get_letter(grade_percent) {
  // manual transfer
  // A 93-100
  // A- 90-93
  // B+ 87-90
  // B 83-87
  // B- 80-83
  // C+ 77-80
  // C 73-77
  // C- 70-73
  // D+ 67-70
  // D 60-67
  // E <60
  // transfer from percent to letter
  var grade_letter;
  if (grade_percent >= 93) {
    grade_letter = 'A';
  } else if (grade_percent >= 90) {
    grade_letter = 'A-';
  } else if (grade_percent >= 87) {
    grade_letter = 'B+';
  } else if (grade_percent >= 83) {
    grade_letter = 'B';
  } else if (grade_percent >= 80) {
    grade_letter = 'B-';
  } else if (grade_percent >= 77) {
    grade_letter = 'C+';
  } else if (grade_percent >= 73) {
    grade_letter = 'C';
  } else if (grade_percent >= 70) {
    grade_letter = 'C-';
  } else if (grade_percent >= 67) {
    grade_letter = 'D+';
  } else if (grade_percent >= 60) {
    grade_letter = 'D';
  } else {
    grade_letter = 'E';
  }
  return grade_letter;
}

function count_gpa() {
  var rows = courses_table.getElementsByTagName('tr');
  var today = new Date();
  var current_month = today.getMonth() + 1;
  var target_term = '';
  if (current_month >= 8) {
    target_term = 'Autumn';
  } else if (current_month >= 5) {
    target_term = 'Summer';
  } else if (current_month >= 1) {
    target_term = 'Spring';
  } else {
    error('Invalid month' + current_month);
    // fallback
    target_term = rows[1].getElementsByTagName('td')[3].textContent.trim();
  }
  target_term += ' ' + String(today.getFullYear());
  console.log(target_term);
  var promises = [];
  var gpa_table = {
    A: 4.0,
    'A-': 3.7,
    'B+': 3.3,
    B: 3.0,
    'B-': 2.7,
    'C+': 2.3,
    C: 2.0,
    'C-': 1.7,
    'D+': 1.3,
    D: 1.0,
    E: 0.0,
  };
  for (let i = 1; i < rows.length; i++) {
    var row = rows[i];
    var cells = row.getElementsByTagName('td'); // course-list-star-column
    var formal_term = cells[3].textContent.trim();
    var published = cells[5].innerHTML.includes('Yes');
    if (formal_term == target_term && published) {
      var a = cells[1].getElementsByTagName('a')[0];
      var general_name = a.getElementsByClassName('name')[0].textContent.trim();
      var re = RegExp(/(.*?) (.*?) - (.*?) \((.*?)\)/).exec(
        general_name.trim()
      );
      // console.log(re);
      var term = re[1].trim();
      var class_name = re[2].trim();
      var long_name = re[3].trim();
      var section = re[4].trim();
      var century_marker =
        parseInt(
          formal_term.substring(formal_term.length - 4, formal_term.length - 2)
        ) - 19; // e.g. 20 - 19 = 1
      var year = parseInt(formal_term.substring(formal_term.length - 2)); // e.g. 23
      var semester = formal_term.split(' ')[0]; // e.g. Autumn
      promises.push(
        new Promise((reslv, rej) =>
          chrome.runtime.sendMessage(
            chrome.runtime.id,
            {
              type: 'GET_CREDIT',
              century: century_marker,
              year: year,
              semester: semester,
              class_name: class_name,
              campus: 'col',
              section: section,
              link: a.href,
            }, // col for Columbus
            (resp) => {
              console.log(resp);
              // not PASS or no PASS
              if (resp.grade.letter != 'S' && resp.grade.letter != 'U') {
                // not a lab section
                if (!resp.lab_percent) credits += resp.credit;
                if (!resp.grade.letter in gpa_table) {
                  console.error('Unknown grade letter', resp.grade.letter);
                  rej();
                } else {
                  // if this is not a lab section
                  if (!resp.lab_percent) {
                    if (
                      courses[`${resp.class_name}`] &&
                      courses[`${resp.class_name}`].lab_percent
                    ) {
                      // the lab section is already filled in
                      var new_percent =
                        resp.grade.percent *
                          (1 - courses[`${resp.class_name}`].lab_percent) +
                        courses[`${resp.class_name}`].percent *
                          courses[`${resp.class_name}`].lab_percent;
                      courses[`${resp.class_name}`] = {
                        letter: get_letter(new_percent),
                        percent: new_percent,
                        credits: resp.credit,
                      };
                    } else {
                      courses[`${resp.class_name}`] = {
                        letter: resp.grade.letter,
                        percent: resp.grade.percent,
                        credits: resp.credit,
                      };
                    }
                  } else {
                    // if it is a lab section
                    if (courses[`${resp.class_name}`]) {
                      // the lec section is already filled in
                      var new_percent =
                        resp.lab_percent * resp.grade.percent +
                        courses[`${resp.class_name}`].percent *
                          (1 - resp.lab_percent);
                      courses[`${resp.class_name}`] = {
                        letter: get_letter(new_percent),
                        percent: new_percent,
                      };
                    } else {
                      courses[`${resp.class_name}`] = {
                        letter: resp.grade.letter,
                        percent: resp.grade.percent,
                        lab_percent: resp.lab_percent,
                      };
                    }
                  }
                }
              }
              reslv();
            }
          )
        )
      );

      console.log(
        term,
        '-',
        class_name,
        '-',
        long_name,
        '-',
        section,
        '-',
        published
      );
      // row.style.backgroundColor = 'green';
    }
  }
  return promises;
}

const courses_table = document.getElementById('my_courses_table');
var courses = {};
var credits = 0.0;

function init() {
  if (courses_table) {
    var butt = document.createElement('button');
    var wrapper = document.createElement('div');
    wrapper.style.marginRight = '0px';
    wrapper.style.marginLeft = 'auto';
    wrapper.appendChild(butt);
    butt.innerText = 'Calculate GPA';
    butt.classList.add('btn');
    butt.style.backgroundColor = '#5cc46b';
    document.getElementsByClassName('header-bar')[0].appendChild(wrapper);

    butt.addEventListener('click', async () => {
      butt.disabled = true;
      butt.innerText = 'Calculating...';
      // popup for float
      var cum_gpa = -2.0;
      var cum_credits = -2;
      while (true) {
        var ans = prompt(
          "current cumulative GPA? (e.g. 3.14), input -1 if you don't want to calculate cumulative GPA",
          '3.14'
        );
        if (ans == null) {
          // cancelled
          break;
        }
        ans = parseFloat(ans);
        if (!isNaN(ans) && (ans == -1 || (ans >= 0 && ans <= 4.0))) {
          cum_gpa = ans;
          break;
        } else {
          alert('Invalid input!');
        }
      }
      if (cum_gpa == -1.0) cum_credits = -1.0;
      else
        while (true) {
          var ans = prompt(
            "current taken credit? (e.g. 15), input -1 if you don't want to calculate cumulative GPA",
            '15'
          );
          if (ans == null) {
            // cancelled
            break;
          }
          ans = parseInt(ans);
          if (!isNaN(ans) && (ans == -1 || (ans >= 0 && ans <= 500))) {
            cum_credits = ans;
            break;
          } else {
            alert('Invalid input!');
          }
        }
      if (cum_gpa == -2.0 || cum_credits == -2) {
        butt.innerText = 'Calculate GPA';
        butt.disabled = false;
        return;
      }
      Promise.all(count_gpa())
        .then(() => {
          var gpa = 0.0;
          console.log(courses);
          for (const [key, value] of Object.entries(courses)) {
            gpa += value.percent * value.credits;
          }
          var dont_cal_cum = cum_gpa == -1.0 || cum_credits == -1.0;
          if (!dont_cal_cum)
            var new_cum =
              (cum_gpa * cum_credits + gpa) / (credits + cum_credits);
          console.log('semester credits', credits);
          console.log('raw GPA value', gpa);
          console.log('semester GPA', gpa / credits);
          console.log(
            'Current cumulative GPA',
            cum_gpa == -1.0 ? 'N/A' : cum_gpa
          );
          console.log(
            'Current cumulative credits',
            cum_credits == -1.0 ? 'N/A' : cum_credits
          );
          console.log('New cumulative GPA', dont_cal_cum ? 'N/A' : new_cum);
          alert(
            `Current semester credit: ${credits}\nCurrent semester GPA: ${
              gpa / credits
            }\nNew cumulative GPA: ${
              dont_cal_cum ? 'N/A' : new_cum
            }\nMore info in console`
          );
        })
        .catch((e) => {
          console.error(e);
          console.error('Error in counting GPA');
        })
        .finally(() => {
          butt.innerText = 'Calculate GPA';
          butt.disabled = false;
        });
    });
  }
}

enableModules.get((result) => {
  if (result && result.gpa_calculator) {
    init();
  } else {
    console.log('GPA calculator module is disabled');
  }
});
