// import firebase config
import {
    get,
    ref,
    update
} from "https://www.gstatic.com/firebasejs/10.5.2/firebase-database.js";

import {
    db,
} from "../js/firebase_config.js";

// initialize variables for global usage
var active_set = 1;
var show_team_score = 0;
var show_color = 1;
var page_type, page_channel, matchRef;


$(document).ready(function () {

    // check if it's board or admin page
    page_type = $('html').attr("type");

    // read URL params for channel selection
    var $channel_input = $("#channel");
    var urlParams = new URLSearchParams(window.location.search);
    var url_id = urlParams.get('channel') || 1;

    // change channel on first load
    page_channel = url_id;
    matchRef = ref(db, `match-${page_channel}`);
    if (page_type == "admin") {
        $channel_input.val(url_id);
    }

    // insert live data on first load to get up to date
    insert_live_data(page_channel, page_type);

    // auto reload for live data input
    if (page_type == "board") {
        setInterval(function () {
            reload();
        }, 250); // request every 1/4 seconds
    } else if (page_type == "admin") {
        setInterval(function () {
            update_set_visibilities_and_counter();
            update_team_counter_visibility();
            update_color_indicator_visibility();
        }, 250); // request every 1/4 seconds
    }

    // Channel input dropdown listener
    $channel_input.change(function () {
        page_channel = $(this).val();
        reload();
    });

    // upload local data as any input values changes
    $('input:not([type=submit]), textarea').on('input', function () {
        upload_local_data([this]);
    });

    // interaction for the score buttons
    $('.controls .button').click(function () {
        var $button = $(this);
        var active_set_elem = $(
            '.set.active'); // check which set is active - which determines which score will be changed
        var change = Number($button.attr(
            'change')); // set the change amount based on the attribute on the button

        var team;
        // check for which team the button is
        if ($button.hasClass('team_a')) {
            team = 0;
        } else {
            team = 1;
        }

        var score_elem = active_set_elem.find('.score')[team] // find correct score element based on team
        var score_now = Number($(score_elem).val()); // check score right now
        if (score_now + change >= 0) {
            $(score_elem).val(score_now + change); // update to new score
            upload_local_data([score_elem]); // upload the new score
        }
    });

    // interaction for the set buttons
    $('.set_controls_container .button').click(function () {
        var $button = $(this);
        var $set_counter = $('#Set_Count');
        var change = Number($button.attr('change'));

        var set_now = Number($set_counter.val()); // check set right now
        if (set_now + change > 0 && set_now + change <= 7) {
            $set_counter.val(set_now + change); // update to new set
            upload_local_data([$set_counter]); // upload the new set
        }
    });

    // function for the reset scores button
    $('#reset_scores').click(function () {

        // reset all score values
        $.each($("*[id]"), function (i, elem) {
            var id = $(elem).attr("id");
            if (id.toLowerCase().includes('score') && !id.toLowerCase().includes(
                    'show') && !id.toLowerCase().includes('team')) {
                $(elem).val(0);
            }
        });

        // reset the set count
        $('#Set_Count').val(1);

        // upload the reset changes
        upload_local_data();
    });
});


async function getData() {
    matchRef = ref(db, `match-${page_channel}`);
    var matchData = await get(matchRef);
    var matchDataObject = matchData.val(); // Assuming your data is an object
    return matchDataObject;
}


// helper funtion to determine if a value is a number
function isNumeric(value) {
    return /^-?\d+$/.test(value);
}


// helper function to convert rgb value to hex value
function rgb2hex(rgb) {
    if (/^#[0-9A-F]{6}$/i.test(rgb)) return rgb;
    rgb = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);

    function hex(x) {
        return ("0" + parseInt(x).toString(16)).slice(-2);
    }
    return "#" + hex(rgb[1]) + hex(rgb[2]) + hex(rgb[3]);
}


function getColorBrightness(hexColor) {
    var r = parseInt(hexColor.substr(1, 2), 16);
    var g = parseInt(hexColor.substr(3, 2), 16);
    var b = parseInt(hexColor.substr(5, 2), 16);

    return (r * 299 + g * 587 + b * 114) / 1000;
}


// helper function the returns the paths and values to json objects
function getPathsAndValues(obj, currentPath = []) {
    const result = {};

    for (const key in obj) {
        const value = obj[key];
        const path = [...currentPath, key];

        if (typeof value === 'object' && !Array.isArray(value)) {
            Object.assign(result, getPathsAndValues(value, path));
        } else {
            result[path] = value;
        }
    }

    return result;
}


// function that inserts the data from the database in the html
async function insert_live_data(channel, type) {
    // console.log("inserting live data for ", type, " and channel ", channel);

    // receive data from firebase
    var data = await getData(db);
    var pathsAndValues = getPathsAndValues(data);

    $.each((pathsAndValues), function (keys, value) {

        // convert cssSelector to string
        var cssSelector;
        if (keys.includes(',')) {
            var keysList = keys.split(',');
            cssSelector = keysList.map(key => `[fb-data="${key}"]`).join(' ');
        } else {
            cssSelector = `[fb-data="${keys}"]`;
        }

        // get according element in html
        var $elem = $(cssSelector);

        // get for which team the value is for
        var team;
        if (cssSelector.includes('team_a')) {
            team = "a";
        } else {
            team = "b";
        }

        if (cssSelector.includes('active_set')) {
            active_set = value;
            $elem.val(active_set);
        } else if (cssSelector.includes('show_color')) {
            show_color = value;
        } else if (cssSelector.includes('show_group_score')) {
            show_team_score = value;
        } else {
            if (type == "board") {
                if (cssSelector.includes('color')) {
                    $('html').css("--" + team.toUpperCase() + "_Color", value)
                    // add "light" class if color is light to preserve readabiltiy
                    if (getColorBrightness(rgb2hex(value)) >= 230) {
                        $elem.addClass('light');
                    } else {
                        $elem.removeClass('light');
                    }
                } else if (cssSelector.includes(`set_${active_set}`)){
                    $elem.text(value);
                    if (cssSelector.includes('team_a')) {
                        $('#A_Score_Active').text(value);
                    } else if (cssSelector.includes('team_b')) {
                        $('#B_Score_Active').text(value);
                    }
                } else {
                    $elem.text(value);
                }
            } else if (type == "admin") {
                $elem.val(value);
            }

        }

    });
}


// helper function to update the active set
function update_set_visibilities_and_counter() {

    var a_sets_won = 0;
    var b_sets_won = 0;

    // go through all html .set elements
    $.each($('.set'), function (i, set) {
        var $set = $(set);

        // extract scores from this set
        var $score_elems = $set.find('p.score');
        var $score_team_a = $($score_elems[0]);
        var $score_team_b = $($score_elems[1]);
        var score_1 = Number($score_team_a.text());
        var score_2 = Number($score_team_b.text());

        // select set elements that are below the active set - finished sets
        if (i + 1 < active_set) {

            // show and make not active
            $set.show();
            $set.removeClass('active');

            // highlight winner team
            // if first team has the higher score
            if (score_1 > score_2) {
                $score_team_a.removeClass('loser').addClass('winner');
                $score_team_b.removeClass('winner').addClass('loser');
                a_sets_won += 1;

                // if second team has the higher score
            } else if (score_1 < score_2) {
                $score_team_a.removeClass('winner').addClass('loser');
                $score_team_b.removeClass('loser').addClass('winner');
                b_sets_won += 1;

                // if scores are equal
            } else {
                $score_team_a.removeClass('winner').addClass('lose');
                $score_team_b.removeClass('winner').addClass('loser');
            }

            // select active set
        } else if (i + 1 == active_set) {

            // show and make active
            $set.show();
            $set.addClass('active');

            // remove classes for finished sets
            $score_team_a.removeClass('winner').removeClass('loser');
            $score_team_b.removeClass('winner').removeClass('loser');

            // select sets above the active set
        } else if (i + 1 > active_set) {

            // hide and make not active
            $set.hide();
            $set.removeClass('active');
        }
    });

    set_set_counter(a_sets_won, b_sets_won);
}


function set_set_counter(a_sets_won, b_sets_won) {
    $('#a_sets_won').text(a_sets_won);
    $('#b_sets_won').text(b_sets_won);
}


// helper function to update if the team counter get's shown
function update_team_counter_visibility() {
    if (show_team_score == 1) {
        $('.group_score').show();
        $('.group-indicator').show();
        $('#Show_Team_Score').prop("checked", true);
    } else {
        $('.group_score').hide();
        $('.group-indicator').hide();
        $('#Show_Team_Score').prop("checked", false);
    }
}


// helper function to update if the team colors get shown
function update_color_indicator_visibility() {
    if (show_color == 1) {
        $('.color-indicator').show();
        $('#Show_Color').prop("checked", true);
    } else if (show_color == 0) {
        $('.color-indicator').hide();
        $('#Show_Color').prop("checked", false);
    }
}


// function that uploads all the local data to the database
function upload_local_data(elemList) {

    // upload all if there are no specific elements
    if (typeof elemList == 'undefined') {
        elemList = $("*[fb-data]");
    }

    // set all the relevant vars for this page
    active_set = $('#Set_Count').val();

    if ($('#Show_Team_Score').is(":checked")) {
        show_team_score = 1
    } else {
        show_team_score = 0
    }

    if ($('#Show_Color').is(":checked")) {
        show_color = 1
    } else if ($('#Show_Color').is(":checkbox")) {
        show_color = 0
    }

    // upload all data to firebase
    const newData = {};
    $.each($(elemList), function (i, elem) {
        var value;

        if ($(elem).is(":checkbox")) {
            if ($(elem).is(":checked")) {
                value = 1;
            } else {
                value = 0;
            }
        } else {
            value = $(elem).val();
        }

        if (value !== "") {
            var html_parents = $(elem).parents();
            var attrs_list = [];
            $.each($(html_parents), function (j, parent) {
                var fb_data = $(parent).attr("fb-data");
                if (fb_data !== undefined) {
                    attrs_list.unshift(fb_data)
                }

            });
            attrs_list.push($(elem).attr("fb-data"))
            var dbSelector = attrs_list.join('/')
            var path_to_variable = `/match-${page_channel}/${dbSelector}`;
            newData[path_to_variable] = value;
        }
    });

    console.log(newData);

    update(ref(db), newData)
        .then(function () {
            // console.log("User data updated successfully.");
            update_set_visibilities_and_counter();
            update_team_counter_visibility();
            update_color_indicator_visibility();
        })
        .catch(function (error) {
            console.error("Error updating user data:", error);
        });
}


// reload every data
function reload() {
    insert_live_data(page_channel, page_type);
    // apply all the special variables - with a bit delay so the database values are safely loaded
    setTimeout(function () {
        update_set_visibilities_and_counter();
        update_team_counter_visibility();
        update_color_indicator_visibility();
    }, 500)
}