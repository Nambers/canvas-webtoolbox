'use strict';

console.log('> OSU Web Toolbox active! <');

const enableModules = {
  get: (cb) => {
    chrome.storage.local.get([`enableModules`], (result) => {
      cb(result[`enableModules`]);
    });
  },
};

function count_gpa() {
  var rows = courses_table.getElementsByTagName('tr');
  var today = new Date();
  var current_month = today.getMonth() + 1;
  var target_term = "";
  if(current_month >= 8){
    target_term = "Autumn";
  }else if(current_month >= 5){
    target_term = "Summer";
  }else if(current_month >= 1){
    target_term = "Spring";
  }else{
    error("Invalid month" + current_month);
    // fallback
    target_term = rows[1].getElementsByTagName('td')[3].textContent.trim(); 
  }
  target_term += " " + String(today.getFullYear());
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
              if (resp.grade.letter != 'S' && resp.grade.letter != 'U') {
                // not PASS or no PASS
                credits += resp.credit;
                if (!resp.grade.letter in gpa_table) {
                  console.error('Unknown grade letter', resp.grade.letter);
                  rej();
                } else {
                  gpa += resp.credit * gpa_table[resp.grade.letter];
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
var gpa = 0.0;
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
          "current cumulative GPA? (e.g. 3.14), input -1 if you don't want to calculate cumulative GPA"
        );
        if (ans == null) {
          // cancelled
          break;
        }
        ans = parseFloat(ans);
        if (!isNaN(ans)) {
          cum_gpa = ans;
          break;
        } else {
          alert('Invalid input!');
        }
      }
      while (true) {
        var ans = prompt(
          "current taken credit? (e.g. 15), input -1 if you don't want to calculate cumulative GPA"
        );
        if (ans == null) {
          // cancelled
          break;
        }
        ans = parseInt(ans);
        if (!isNaN(ans)) {
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
      await Promise.all(count_gpa());
      var dont_cal_cum = cum_gpa == -1.0 || cum_credits == -1.0;
      if (!dont_cal_cum)
        var new_cum = (cum_gpa * cum_credits + gpa) / (credits + cum_credits);
      console.log('semester credits', credits);
      console.log('raw GPA value', gpa);
      console.log('semester GPA', gpa / credits);
      console.log('Current cumulative GPA', cum_gpa == -1.0 ? 'N/A' : cum_gpa);
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
      butt.innerText = 'Calculate GPA';
      butt.disabled = false;
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
