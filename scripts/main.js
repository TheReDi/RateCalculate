// Клавиши
var keyDrillSpeed = KeyCode.c;
var keyPressed = KeyCode.controlLeft;

// Исключения
const drillTypes = [
    Blocks.mechanicalDrill,
    Blocks.pneumaticDrill,
    Blocks.laserDrill,
    Blocks.blastDrill,
    Blocks.eruptionDrill,
    Blocks.impactDrill,
];
// TODO доработать
const siliconCrucible = Blocks.siliconCrucible;

// Состояние
var dragging = false;
var pressed = false;
var startX = 0, startY = 0, endX = 0, endY = 0;
var regions = [];
const mainTable = new Table();

Events.on(ClientLoadEvent, function(){
    mainTable.bottom().left().margin(10);
    Vars.ui.hudGroup.addChild(mainTable);
});

Events.run(Trigger.draw, function(){
    if (dragging) {
        let wx1 = Math.min(startX, endX) * Vars.tilesize;
        let wy1 = Math.min(startY, endY) * Vars.tilesize;
        let wx2 = (Math.max(startX, endX) + 1) * Vars.tilesize;
        let wy2 = (Math.max(startY, endY) + 1) * Vars.tilesize;

        Draw.z(Layer.overlayUI - 1);
        Lines.stroke(2, Pal.items);
        Lines.rect(wx1 - Vars.tilesize/2, wy1 - Vars.tilesize/2, wx2 - wx1, wy2 - wy1);
        Draw.color(Pal.items, 0.1);
        Fill.rect((wx1+wx2)/2 - Vars.tilesize/2, (wy1+wy2)/2 - Vars.tilesize/2, wx2-wx1, wy2-wy1);
        Draw.reset();
    }

    regions.forEach((region, index) => {
        let wx1 = Math.min(region.startX, region.endX) * Vars.tilesize;
        let wy1 = Math.min(region.startY, region.endY) * Vars.tilesize;
        let wx2 = (Math.max(region.startX, region.endX) + 1) * Vars.tilesize;
        let wy2 = (Math.max(region.startY, region.endY) + 1) * Vars.tilesize;

        Draw.z(Layer.overlayUI - 1);
        Lines.stroke(2, Pal.items);
        Lines.rect(wx1 - Vars.tilesize/2, wy1 - Vars.tilesize/2, wx2 - wx1, wy2 - wy1);
        Draw.color(Pal.items, 0.1);
        Fill.rect((wx1+wx2)/2 - Vars.tilesize/2, (wy1+wy2)/2 - Vars.tilesize/2, wx2-wx1, wy2-wy1);
        Draw.reset();
    });
});

Events.run(Trigger.update, function(){
    const ctrlPressed = Core.input.keyDown(keyPressed);
    
    if (Core.input.keyTap(keyDrillSpeed)) {
        // Начало новой области
        startX = World.toTile(Core.input.mouseWorldX());
        startY = World.toTile(Core.input.mouseWorldY());
        dragging = true;
    }
    
    if (dragging) {
        endX = World.toTile(Core.input.mouseWorldX());
        endY = World.toTile(Core.input.mouseWorldY());
        
        if (ctrlPressed) {
            // Добавляем область в список
            if (!Core.input.keyDown(keyDrillSpeed)) {
                regions.push({
                    startX: startX,
                    startY: startY,
                    endX: endX,
                    endY: endY
                });
            }
        } else {
            regions[0] = {
                startX: startX,
                startY: startY,
                endX: endX,
                endY: endY
            }
        }

        if (!Core.input.keyDown(keyDrillSpeed)) {
            dragging = false;
        }
    }

    updateStatistics();

    if (!ctrlPressed) regions = [];
});

function updateStatistics() {
    mainTable.clearChildren();
    
    if (regions.length === 0) {
        mainTable.add("[lightgray]Select area (C)[]").left().row();
        mainTable.add("[lightgray]Select more areas (Ctrl+C)[]").left();
        return;
    }
    
    // Суммарная статистика по всем областям
    let totalDrillStats = { sum: 0, effTotal: 0, amount: 0 };
    let totalFactoriesInput = new ObjectMap();
    let totalFactoriesOutput = new ObjectMap();
    
    // Собираем данные со всех областей
    regions.forEach((region, index) => {
        const drillStats = getDrillStatsForRegion(region);
        const factoryStats = getFactoriesStatsForRegion(region);
        
        // Суммируем буры
        totalDrillStats.sum += drillStats.sum;
        totalDrillStats.effTotal += drillStats.effTotal;
        totalDrillStats.amount += drillStats.amount;
        
        // Суммируем фабрики (вход)
        factoryStats.factoriesInput.each((item, amount) => {
            totalFactoriesInput.put(item, totalFactoriesInput.get(item, 0) + amount);
        });
        
        // Суммируем фабрики (выход)
        factoryStats.factoriesOutput.each((item, amount) => {
            totalFactoriesOutput.put(item, totalFactoriesOutput.get(item, 0) + amount);
        });
    });
    
    // Статистика буров
    const drillTable = new Table();
    drillTable.add("[accent]Drills:[]").row();
    drillTable.add("Speed: ").left();
    drillTable.add(Math.round(totalDrillStats.sum * 100) / 100 + "/sec").left().row();
    drillTable.add("Efficiency: ").left();
    drillTable.add(Math.round(totalDrillStats.effTotal / totalDrillStats.amount * 1000) / 10 + "%").left().row();
    mainTable.add(drillTable).row();
    
    // Статистика фабрик (вход)
    if (totalFactoriesInput.size > 0) {
        mainTable.row();
        mainTable.add("[accent]Input:[]").row();
        
        totalFactoriesInput.each((input, amount) => {
            const rowTable = new Table();
            rowTable.add(new Image(input.uiIcon)).size(24);
            rowTable.add(input.localizedName + ": ").left();
            rowTable.add(Math.round(amount * 100) / 100 + "/sec").left();
            mainTable.add(rowTable).left().row();
        });
    }
    
    // Статистика фабрик (выход)
    if (totalFactoriesOutput.size > 0) {
        mainTable.row();
        mainTable.add("[accent]Output:[]").row();
        
        totalFactoriesOutput.each((output, amount) => {
            const rowTable = new Table();
            rowTable.add(new Image(output.uiIcon)).size(24);
            rowTable.add(output.localizedName + ": ").left();
            rowTable.add(Math.round(amount * 100) / 100 + "/sec").left();
            mainTable.add(rowTable).left().row();
        });
    }
}

// Функции для работы с отдельными областями
function getDrillStatsForRegion(region) {
    let minx = Math.min(region.startX, region.endX);
    let miny = Math.min(region.startY, region.endY);
    let maxx = Math.max(region.startX, region.endX);
    let maxy = Math.max(region.startY, region.endY);

    let sum = 0;
    let amount = 0;
    let effTotal = 0;

    for(let x = minx; x <= maxx; x++){
        for(let y = miny; y <= maxy; y++){
            let tile = Vars.world.tile(x, y);
            if(tile == null || tile.build == null) continue;

            let build = tile.build;
            if(build.block && drillTypes.includes(build.block)){
                if (tile.build.dominantItem == tile.drop())
                    sum += getDrillRate(build);
                amount++;
                effTotal += build.efficiency;
            }
        }
    }

    return {sum: sum, effTotal: effTotal, amount: amount};
}

function getFactoriesStatsForRegion(region) {
    let minx = Math.min(region.startX, region.endX);
    let miny = Math.min(region.startY, region.endY);
    let maxx = Math.max(region.startX, region.endX);
    let maxy = Math.max(region.startY, region.endY);

    let factoriesInput = new ObjectMap();
    let factoriesOutput = new ObjectMap();
    let IDs = [];

    for(let x = minx; x <= maxx; x++){
        for(let y = miny; y <= maxy; y++){
            let build = Vars.world.build(x, y);
            if (!build) continue;

            let block = build.block;
            if (!block || !block.craftTime) continue;

            if (!IDs.includes(build.id)) {
                IDs.push(build.id);

                // Input
                if (block.consumers && block.consumers.length > 0) {
                    for (let consumer of block.consumers) {
                        if (consumer instanceof ConsumeItems) {
                            for (let item of consumer.items) {
                                factoriesInput.put(item.item, item.amount / block.craftTime * 60 * build.timeScale() + factoriesInput.get(item.item, 0));
                            }
                        }
                        if (consumer instanceof ConsumeLiquid) {
                            factoriesInput.put(consumer.liquid, consumer.amount * 60 * build.timeScale() + factoriesInput.get(consumer.liquid, 0));
                        }
                    }
                }

                // Output
                if (block.outputItem) {
                    factoriesOutput.put(block.outputItem.item, block.outputItem.amount / block.craftTime * 60 * build.timeScale() + factoriesOutput.get(block.outputItem.item, 0));
                }
                if (block.outputLiquid) {
                    factoriesOutput.put(block.outputLiquid.liquid, block.outputLiquid.amount * 60 * build.timeScale() + factoriesOutput.get(block.outputLiquid.liquid, 0));
                }
            }
        }
    }

    return {factoriesInput: factoriesInput, factoriesOutput: factoriesOutput};
}

function getDrillRate(drill) {
    const drillingItem = drill.dominantItem;

    const baseDrillTime = drill.block.getDrillTime(drillingItem);
    if(baseDrillTime <= 0) return 0;

    let liquidBoost = 1;

    if(drill.block.hasLiquids && drill.liquids.currentAmount() >= 0.001) {
        liquidBoost *= drill.block.liquidBoostIntensity * drill.block.liquidBoostIntensity;
    }

    return (60 / baseDrillTime * liquidBoost * drill.timeScale());
}