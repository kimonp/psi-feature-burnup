Ext.define("VelocityCalculator", {
    app: null,
    gridPanelId: '#gridPanel',

    storeFields: ['startName', 'endName', 'days', 'acceptVelocity', 'acceptDelta', 'scopeVelocity', 'scopeDelta',
                    'acceptPoints', 'accPointsPerMo',
        	         'segmentVelPerMo', 'segmentVel'],

    constructor: function(theApp) {
        this.app = theApp;

        return this;
    },

    today: function() {
        return Ext.Date.format(new Date(), 'Y-m-d');
    },

    resetPanel: function() {
        var panel  = this.app.down(this.gridPanelId);

        if (panel !== null) {
            panel.removeAll();
        }
    },

    addGridsToPanel: function (grids) {

        var panel = this.app.down(this.gridPanelId);

        _.each(grids, function(newGrid) {
            panel.add(newGrid);
        });
        panel.update();
    },

    addGrids: function(seriesData, milestones, iterations) {
        this.resetPanel();

        this.createDateCollection(seriesData);

        this.addGridsToPanel([
        		 this.getOverallVelocityGrid(seriesData),
        		 this.getIterationVelocityGrid(seriesData, iterations),
        		 this.getMilestoneVelocityGrid(seriesData, milestones)
        ]);
    },

    calcDoneDate: function(totalPoints, acceptedPoints, avgMoVelocity) {
        var avgDayVelocity	= avgMoVelocity.match(/^\d+(\.\d+)?$/) ? Math.round(avgMoVelocity/30) : '';
        var daysToFinish	= avgDayVelocity ? Math.round((totalPoints - acceptedPoints)/avgDayVelocity) : '';
        var doneDate		= daysToFinish === '' ? 'n/a' : Ext.Date.format(Ext.Date.add(new Date(), Ext.Date.DAY, daysToFinish), 'Y-m-d');

        return doneDate;
    },

    calcPct: function(num, total) {
        var pct	= total ? Math.round(num/total*100) : '-';

        return pct;
    },

    addPctToNum: function(num, total) {
        var pct	= this.calcPct(num, total);

        return num + ' (' + pct + '%)';
    },

    getOverallStats: function(seriesData, P0) {
        var entryCount 		= seriesData.length - 1;
        var firstEntry		= seriesData[0];
        var lastEntry		= seriesData[entryCount];
        var startDate		= firstEntry.label;
        var endDate			= lastEntry.label;
        var today			= this.today();
        var compDate		= today < endDate ? today : endDate;

        var acceptField		= P0 === true ? 'P0 Accepted Points' : 'Accepted Points';
        var storyField		= P0 === true ? 'P0 Points' : 'Total Points';

        var startAccPoints	= Math.round(firstEntry[acceptField]);
        var acceptedPoints	= Math.round(lastEntry[acceptField]);
        var curAccPoints	= acceptedPoints - startAccPoints;
        var totalPoints		= Math.round(lastEntry[storyField]);
        var remainingPoints	= totalPoints - curAccPoints;
        var totalDays	  	= this.subtractDates(endDate, startDate);
        var daysPast	  	= this.subtractDates(compDate, startDate);
        var monthsPast	    = daysPast / 30;
        var daysPct			= totalDays ? Math.round(daysPast/totalDays*100) + '%' : '-';
        var avgMoVelocity	= monthsPast ? Math.round(curAccPoints/monthsPast).toString() : '-';
 //       var avgDayVelocity	= daysPast ? Math.round(curAccPoints/daysPast) : '0';
//        var daysToFinish	= avgDayVelocity ? Math.round((totalPoints - acceptedPoints)/avgDayVelocity) : '';
        var doneDate		= this.calcDoneDate(totalPoints, acceptedPoints, avgMoVelocity);

        return {
            avgMoVelocity:	avgMoVelocity,
            totalPoints:	totalPoints,
            acceptedPoints:	acceptedPoints,
            remainingPoints:this.addPctToNum(remainingPoints, totalPoints),
            daysPct:		daysPct,
            doneDate:		doneDate
        };
    },

    getOverallVelocityGrid: function(seriesData) {
        var totalStats		= this.getOverallStats(seriesData, false);
        var p0Stats			= this.getOverallStats(seriesData, true);

		var getEditorFunc = function(record) {
			var edit		= record && record.get('edit');
			var formType	= 'Ext.form.field.Number';
			var formConfig	= null;

			return edit === true ? Ext.create('Ext.grid.CellEditor', { field: Ext.create(formType, formConfig)}) : null;
		};

        var stats			= [
                 { stat: 'Avg. Velocity / Month',  value: totalStats.avgMoVelocity,  P0Value: p0Stats.avgMoVelocity, edit: true },
                 { stat: 'Total Points',           value: totalStats.totalPoints,    P0Value: p0Stats.totalPoints, edit: true },
                 { stat: 'Accepted Points',        value: totalStats.acceptedPoints, P0Value: p0Stats.acceptedPoints },
                 { stat: 'Remaining Points',       value: totalStats.remainingPoints,P0Value: p0Stats.remainingPoints },
                 { stat: '% Time Used',            value: totalStats.daysPct,		 P0Value: p0Stats.daysPct },
                 { stat: 'Completion Estimate',    value: totalStats.doneDate,		 P0Value: p0Stats.doneDate }
           ];
        var store	= Ext.create('Ext.data.Store', {
            	storeId: 'overallVelocityStore',
            	fields: ['stat', 'value', 'P0Value', 'edit'],
                data: { 'items': stats },
                proxy: { type: 'memory', reader: { type: 'json', root: 'items' } }
            });

        var that = this;
        var newGrid = Ext.create('Ext.grid.Panel', {
            title: 'Overall Stats',
            itemId: 'velocityStatsGrid',
            store: store,
            columns: [
                      { text: 'Statistic',  dataIndex: 'stat', flex: 200, align: 'right' },
                      { text: 'All',		dataIndex: 'value', getEditor: getEditorFunc},
                      { text: 'P0 Only',    dataIndex: 'P0Value', getEditor: getEditorFunc}
            ],
			plugins: [{
				ptype: 'cellediting',
				clicksToEdit: 1,
                listeners: {
                    edit: function(editor, e) {
                        console.log('we were edited', e);

                        if (e.value != e.originalValue) {
                            var grid	= e.grid;
                            var field	= e.field;
                            var models	= grid.getStore().getRange();

                            var velocity	= models[0].get(field).toString();
                            var totPoints	= models[1].get(field).toString();
                            var accPoints	= models[2].get(field).toString();
                            var remPoints	= this.addPctToNum(totPoints-accPoints, totPoints);

                            console.log('calc', totPoints, accPoints, velocity);

                            var doneDate = that.calcDoneDate(totPoints, accPoints, velocity);

                            models[5].set(field, doneDate); // Set new done date

                            models[3].set(field, remPoints); // Set new points remaining
                        }
                    },
            		scope: this
                }
			}],
            width: 400,
            renderTo: Ext.getBody()
        });

        return newGrid;
    },

    //
    // Create a collection of dates from seriesData so that we can lookup
    // points by dates;
    //
    createDateCollection: function(seriesData) {
        var dateCollection = {};
            _.each( seriesData, function(pointData) {
                var date		= pointData.label;

                dateCollection[date] = pointData;
            });

        return this.dateCollection = dateCollection;
    },

    todayPointData: function() {
        var today = this.today();

        return this.dateCollection[today];
    },

    addVelocitySegmentEntry: function(items, name, nextName, date, nextDate) {
        var pointData	  = date && this.dateCollection[date];
        var nextPointData = nextDate && this.dateCollection[nextDate];

        if (this.dateIsFuture(date)) {
        	// Skip stuff that has not yet happened

        } else if (pointData && nextPointData) {
            	if (nextDate > this.today()) { // Truncate to today, if the segment ends after the current date
                    var todayPointData = this.todayPointData();

                    if (todayPointData) {
                        nextPointData = this.todayPointData();
                        nextDate	  = this.today();
                	}
            	}
            var acceptedDiff  = nextPointData['Accepted Points'] - pointData['Accepted Points'];
            var scopeDiff	  = nextPointData['Total Points'] - pointData['Total Points'];
            var days	  	  = this.subtractDates(nextDate, date);
            var months		  = days / 30;

            if (!_.isNaN(acceptedDiff)) {
                items.push({
                    startName:		name,
                    endName:		nextName + ' (' + days + ' days)',
                    days:			days,
                    segmentVel:		Math.round(acceptedDiff - scopeDiff),
                    segmentVelPerMo:months ? Math.round((acceptedDiff - scopeDiff)/months * 100) / 100 : '-',

                    acceptPoints:   Math.round(acceptedDiff),
                    accPointsPerMo: months ? Math.round((acceptedDiff)/months * 100) / 100 : '-',

                    acceptDelta:    this.velocityStr(acceptedDiff, months),
                    scopeDelta:     this.velocityStr(scopeDiff, months),
                    effectiveVel:   this.velocityStr(acceptedDiff - scopeDiff, months)
                });
            }
        }
    },

    getIterationItems: function(iterations, seriesData) {
        var items			= [];
        var that			= this;
        var today			= this.today();

        var uniqIterations = _.sortBy(_.uniq(_.map(iterations, function(i){ return i.raw;}), 'Name'), 'StartDate');

        _.each( uniqIterations, function(iteration) {
            var date	  = iteration.StartDate.replace(/T.*/, '');
            var nextDate  = iteration.EndDate.replace(/T.*/, '');
            var name	  = iteration.Name;
            var nextName  = name;

            that.addVelocitySegmentEntry(items, name, nextName, date, nextDate);
        });
        return items;
    },

    getIterationVelocityGrid: function(seriesData, iterations) {
        var items	= this.getIterationItems(iterations, seriesData);
        var store	= Ext.create('Ext.data.Store', {
            	storeId: 'iterationVelocityStore',
            	fields: this.storeFields,
                data: { 'items': items },
                proxy: { type: 'memory', reader: { type: 'json', root: 'items' } }
            });

        var newGrid = Ext.create('Ext.grid.Panel', {
            title: 'Iteration Velocities',
            itemId: 'iterationVelocitiesGrid',
            store: store,
            columns: [
                      { text: 'Iteration',       dataIndex: 'endName', flex: 300, align: 'right', hidden: false },
                      { text: 'Accepted Points',     dataIndex: 'acceptPoints', hidden: false},
                      { text: 'Acc / Month', dataIndex: 'accPointsPerMo', hidden: false },
                      { text: 'Effective Velocity', dataIndex: 'segmentVel', hidden: true },
                      { text: 'Scope Change',        dataIndex: 'scopeDelta', hidden: true }
            ],
            width: 400,
            renderTo: Ext.getBody()
        });

        return newGrid;
    },

    getMilestoneVelocityGrid: function(seriesData, milestones) {
        this.milestones = milestones;

        var items	= this.getMilestoneItems(seriesData);
        var store	= Ext.create('Ext.data.Store', {
            	storeId: 'milestoneVelocityStore',
            	fields: this.storeFields,
                data: { 'items': items },
                proxy: { type: 'memory', reader: { type: 'json', root: 'items' } }
            });

        var newGrid = Ext.create('Ext.grid.Panel', {
            title: 'Milestone Segment Velocities',
            itemId: 'milestoneVelocitiesGrid',
            store: store,
            columns: [
                      { text: 'Segment Start',   dataIndex: 'startName', flex: 200, hidden: true  },
                      { text: 'Segment End',       dataIndex: 'endName', flex: 200, align: 'right' },
                      { text: 'Segment Velocity', dataIndex: 'segmentVel' },
                      { text: 'SV / Month', dataIndex: 'segmentVelPerMo' },
                      { text: 'Accepted Points',     dataIndex: 'acceptDelta', hidden: true},
                      { text: 'Scope Change',        dataIndex: 'scopeDelta', hidden: true }
            ],
            width: 400,
            renderTo: Ext.getBody()
        });

        return newGrid;
    },

    //
    // Initialize the milestoneDates collection, used to calculate segment velocities
    // With the start end end date of the release
    //
    initializeMilestoneSegments:  function (seriesData) {
        var start		   = seriesData[0];
        var startDate	   = start.label;

        var end			   = seriesData[seriesData.length-1];
        var endDate		   = end.label;

        var milestoneDates = {};

    	milestoneDates[startDate] = {
                pointData: start,
                milestoneList:[{ Name: 'Start of Release' }]
    		};

    	milestoneDates[endDate] = {
                pointData: end,
                milestoneList:[{ Name: 'End of Release' }]
    		};
        milestoneDates[startDate].pointData.nextDate = endDate;

    	return milestoneDates;
    },

    // Populate milestoneSegments:
    //   keys are the dates of the milestones
    //   values are: the data that exists on the graph at that date (filled in later) and an array of Milestones for that date
    //
    populateMilestoneSegmentDates: function(seriesData) {
        var milestoneDates	= this.initializeMilestoneSegments(seriesData);
        var relStartDate 	= seriesData[0].label; // Date of the end of the release
        var end				= seriesData[seriesData.length-1];
        var relEndDate 		= end.label; // Date of the end of the release
        var today		   = Ext.Date.format(new Date(), 'Y-m-d');

        var that = this;
        var lastDate		= relStartDate; // Date of the last segment end as we step through them
        _.every( this.milestones.reverse(), function(milestone) {
            var data = milestone.raw;
            var date = data.TargetDate.replace(/T.*/, '');

            if (date > today) {
                data.Name = 'Today - ' + today;
            }

            if (date > relStartDate && date < relEndDate) {
                var dateInfo = milestoneDates[date];
                    if (!dateInfo) { dateInfo = milestoneDates[date] = { pointData: {}, milestoneList:[] }; }

                dateInfo.milestoneList.push(data);

                if (lastDate) {
                    milestoneDates[lastDate].pointData.nextDate = date;
                }
                lastDate = date;
            }

           	return !that.dateIsFuture(date); // Quit once we get past the current date
        });

        return milestoneDates;
    },

    getMilestoneItems: function(seriesData) {
        var items	 	= [];
        var that		= this;

        var milestoneDates = this.populateMilestoneSegmentDates(seriesData);

        //
        // Step through the chart series data, and fill in the pointDate information into milestoneDates
        //
        _.each( seriesData, function(pointData) {
            var date		= pointData.label;
            var dateEntry	= milestoneDates[date];

            if (dateEntry) {
            	dateEntry.pointData = _.extend(dateEntry.pointData, pointData);
            }

        });

        //
        // Step through milestoneDates, and create a velocity entry each segment between
        // the Start of the release, each milestone and the end of the release or current date
        //
        _.each( milestoneDates, function(data, date) {
            var pointData = data.pointData;
            var nextDate  = pointData.nextDate;

            if (that.dateIsFuture(date)) {
            	// Skip stuff that has not yet happened

            } else if (nextDate) {
                var nextName	  = milestoneDates[nextDate].milestoneList[0].Name;

                _.each( data.milestoneList, function(milestone) {
                    var name = milestone.Name;

                    that.addVelocitySegmentEntry(items, name, nextName, date, nextDate);
                });
            }
        });
        return items;
    },

    dateIsFuture: function(dateStr) {
        var date	= Ext.Date.parse(dateStr, 'Y-m-d');
        var today	= new Date();

        return date > today;
    },

    velocityStr: function(pointDelta, months) {
        var velocity	  = Math.round(pointDelta / months * 100) / 100 ;

        return pointDelta  + ' (' + velocity + '/mo)';
    },

    subtractDates: function(d1, d2) {
        var date1 = new Date(d1);
        var date2 = new Date(d2);
        var diff  = date1.getTime() - date2.getTime();

        return diff / (24*60*60*1000);
    }
});
