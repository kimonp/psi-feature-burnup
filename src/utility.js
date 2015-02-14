// utility methods

// returns the release name if the app is on a page scoped to a release.
function getReleaseTimeBox(app) {
    var timeboxScope = app.getContext().getTimeboxScope();
    var tbName = null;
    if(timeboxScope) {
        var record = timeboxScope.getRecord();
        tbName = record.get('Name');
    } else {
        tbName = "";
    }
    return tbName;
}

// generic function to perform a web services query
function wsapiQuery( config , callback ) {

    Ext.create('Rally.data.WsapiDataStore', {
        autoLoad : true,
        limit : "Infinity",
        model : config.model,
        fetch : config.fetch,
        filters : config.filters,
        listeners : {
            scope : this,
            load : function(store, data) {
                callback(null,data);
            }
        }
    });
}

function snapshotQuery( config ,callback) {

    var storeConfig = {
        find    : config.find,
        fetch   : config.fetch,
        hydrate : config.hydrate,
        autoLoad : true,
        pageSize : 10000,
        limit    : 'Infinity',
        listeners : {
            scope : this,
            load  : function(store,snapshots,success) {
                console.log("snapshots:",snapshots.length);
                callback(null,snapshots);
            }
        }
    };
    var snapshotStore = Ext.create('Rally.data.lookback.SnapshotStore', storeConfig);

}

function pointsUnitType(type) {
        return type=="Points";
}

//
// Default settings for the Rally App (in utilities, because these keys are also used in createSeries Array)
//
function getDefaultSettings() {
    return {
        releases                : "",
        epicIds                 : "",
        ignoreZeroValues        : true,

        StoryPoints             : true,
        StoryPointsProjection   : true,
        AcceptedStoryPoints     : true,
        AcceptedPointsProjection: true,

        P0StoryPoints           : true,
        P0AccStoryPoints        : true,
        P0StoryPointsProjection : true,
        P0AccStoryPointsProjection: true
    };
}

function createSeriesArray() {
    return [
        { name : "StoryPoints" ,             description : "Story Points",          field : "LeafStoryPlanEstimateTotal", display : "line", f : "sum", color : "DarkGray" },
        { name : "StoryPointsProjection",    description : "Scope Projection",  projectOn : "Story Points", color : "LightGray" },
        { name : "AcceptedStoryPoints",      description : "Accepted Points",       field : "AcceptedLeafStoryPlanEstimateTotal", display : "line", f : "sum", color : "Green" },
        { name : "AcceptedPointsProjection", description : "Accepted Projection", projectOn : "Accepted Points",        color : "LightGray" },

        { name : "P0StoryPoints" ,           description : "P0 Story Points",       field : "LeafStoryPlanEstimateTotal",
            filterField: "c_Priority", filterValues: ['P0'], display : "line", f : "filteredSum", color: "Black" },
        { name : "P0AccStoryPoints" ,           description : "P0 Accepted Points",       field : "AcceptedLeafStoryPlanEstimateTotal",
            filterField: "c_Priority", filterValues: ['P0'], display : "line", f : "filteredSum", color: "DarkRed" },
        { name : "P0StoryPointsProjection",    description : "P0 Scope Projection",  projectOn : "P0 Story Points",
            filterField: "c_Priority", filterValues: ['P0'], display : "line", f : "filteredSum", color: "LightGray" },
        { name : "P0AccPointsProjection", description : "P0 Accepted P0 Projection", projectOn : "P0 Accepted Points",
            filterField: "c_Priority", filterValues: ['P0'], display : "line", f : "filteredSum", color: "LightGray" },
    ];
}

function createColorsArray( series ) {

    var colors = [];

    _.each( series, function(s,i) {
        if (i>0) {
            var as = _.find( app.series, function(a) {
                return a.description === s.name;
            });
            if (!_.isUndefined(as)) {
                colors.push(as.color);
            } else {
                colors.push("LightGray");
            }

        }
    });

    return colors;

}


function trimHighChartsConfig(hc) {

    // trim future values
    var today = new Date();
    _.each(hc, function(series,i) {
        // for non-projection values dont chart after today
        if (series.name.indexOf("Projection")===-1 && series.name.indexOf("label") ===-1 ) {
            _.each( series.data, function( point , x ){
                if ( Date.parse(hc[0].data[x]) > today )
                    series.data[x] = null;
            });
        }
        // for projection null values before today.
        if (series.name.indexOf("Projection")!==-1) {
//            console.log("projection series",series);
            _.each( series.data, function( point , x ){
                if ( Date.parse(hc[0].data[x]) < today ) {
                    series.data[x] = null;

                }
            });
//                series.color = "#C8C8C8";
            series.dashStyle = 'dash';
        }

    });

    return hc;
}
