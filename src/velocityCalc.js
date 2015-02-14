Ext.define("VelocityCalculator", {
    app: null,
    gridPanelId: '#gridPanel',

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
            console.log('remove oldGrid', panel);
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

        this.addGridsToPanel([
        		 this.getOverallVelocityGrid(seriesData),
        		 this.getMilestoneVelocityGrid(seriesData, milestones),
        		 this.getIterationVelocityGrid(seriesData, iterations)
        ]);
    },

    getOverallVelocityGrid: function(seriesData) {
        var entryCount 		= seriesData.length - 1;
        var firstEntry		= seriesData[0];
        var lastEntry		= seriesData[entryCount];
        var startDate		= firstEntry.label;
        var endDate			= lastEntry.label;
        var today			= this.today();
        var compDate		= today < endDate ? today : endDate;

        var startAccPoints	= firstEntry['Accepted Points'];
        var acceptedPoints	= lastEntry['Accepted Points'];
        var curAccPoints	= acceptedPoints - startAccPoints;
        var totalPoints		= lastEntry['Story Points'];
        var acceptedPct		= totalPoints ? Math.round(curAccPoints/totalPoints*100) + '%' : '-';
        var totalDays	  	= this.subtractDates(endDate, startDate);
        var daysPast	  	= this.subtractDates(compDate, startDate);
        var monthsPast	    = daysPast / 30;
        var daysPct			= totalDays ? Math.round(daysPast/totalDays*100) + '%' : '-';
        var avgMoVelocity	= monthsPast ? Math.round(curAccPoints/monthsPast) : '-';

        var stats			= [
                 { stat: 'Avg. Velocity / Month', value: avgMoVelocity },
                 { stat: 'Total Points', value: totalPoints },
                 { stat: 'Accepted Points', value: acceptedPoints },
                 { stat: 'Accepted % Since Start', value: acceptedPct },
                 { stat: '% Time Used', value: daysPct }
           ];
        var store	= Ext.create('Ext.data.Store', {
            	storeId: 'milestoneVelocityStore',
            	fields: ['stat', 'value'],
                data: { 'items': stats },
                proxy: { type: 'memory', reader: { type: 'json', root: 'items' } }
            });

        var newGrid = Ext.create('Ext.grid.Panel', {
            title: 'Overall Stats',
            itemId: 'velocityStatsGrid',
            store: store,
            columns: [
                      { text: 'Statistic',  dataIndex: 'stat', flex: 200, align: 'right' },
                      { text: 'Value',      dataIndex: 'value'}
            ],
            width: 400,
            renderTo: Ext.getBody()
        });

        return newGrid;
    },

    getIterationItems: function(seriesData) {
        return [];
    },

    getIterationVelocityGrid: function(seriesData, iterations) {
        this.milestones = iterations;

        var items	= this.getIterationItems(seriesData);
        var store	= Ext.create('Ext.data.Store', {
            	storeId: 'milestoneVelocityStore',
            	fields: ['name', 'days', 'acceptVelocity', 'acceptDelta', 'scopeVelocity', 'scopeDelta', 'segmentVelPerMo', 'velocity'],
                data: { 'items': items },
                proxy: { type: 'memory', reader: { type: 'json', root: 'items' } }
            });

        var newGrid = Ext.create('Ext.grid.Panel', {
            title: 'Iteration Velocities',
            itemId: 'iterationVelocitiesGrid',
            store: store,
            columns: [
                      { text: 'Iteration',       dataIndex: 'name', flex: 200, align: 'right' },
                      { text: 'Velocity', dataIndex: 'velocity' },
                      { text: 'SV / Month', dataIndex: 'segmentVelPerMo' },
                      { text: 'Accepted Points',     dataIndex: 'acceptDelta', hidden: true},
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
            	fields: ['startName', 'endName', 'days', 'acceptVelocity', 'acceptDelta', 'scopeVelocity', 'scopeDelta', 'segmentVelPerMo', 'segmentVel'],
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

        console.log('inital milestoneDates', milestoneDates);

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
        var today		   = Ext.Date.format(new Date(), 'Y-m-d');
        var todayPointData = null;
        //
        // Step through the chart series data, and fill in the pointDate information into milestoneDates
        //
        _.each( seriesData, function(pointData) {
            var date		= pointData.label;
            var dateEntry	= milestoneDates[date];

            if (dateEntry) {
            	dateEntry.pointData = _.extend(dateEntry.pointData, pointData);
            }

            if (date == today) {
                todayPointData = pointData;
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
                var nextPointData = milestoneDates[nextDate].pointData;
                	if (nextDate > today && todayPointData) { // Truncate to today, if the segment ends after the current date
                        nextPointData = todayPointData;
                        nextDate = today;
                	}
                var acceptedDiff  = nextPointData['Accepted Points'] - pointData['Accepted Points'];
                var scopeDiff	  = nextPointData['Story Points'] - pointData['Story Points'];
                var days	  	  = that.subtractDates(nextDate, date);
                var months		  = days / 30;

                _.each( data.milestoneList, function(milestone, date) {
                    var name = milestone.Name;

                    if (!_.isNaN(acceptedDiff)) {
                        items.push({
                            startName:		name,
                            endName:		nextName + ' (' + days + ' days)',
                            days:			days,
                            segmentVel:		acceptedDiff - scopeDiff,
                            segmentVelPerMo:Math.round((acceptedDiff - scopeDiff)/months * 100) / 100,

                            acceptDelta:    that.velocityStr(acceptedDiff, months),
                            scopeDelta:     that.velocityStr(scopeDiff, months),
                            effectiveVel:   that.velocityStr(acceptedDiff - scopeDiff, months)
                        });
                    }
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
