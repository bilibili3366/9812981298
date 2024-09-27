(function() {
    var notifications = [];
    console.log("脚本开始执行");
    console.log("请求 URL: " + $request.url);
    console.log("响应状态码: " + $response.status);
    console.log("响应头: " + JSON.stringify($response.headers));

    try {
        var responseBody = JSON.parse($response.body);
        var mallName = responseBody?.mall_entrance?.mall_data?.mall_name;

        console.log("解析到的商店名称：" + mallName);

        if (mallName) {
            console.log("开始检查黑名单");
            checkBlacklist(mallName, responseBody);
        } else {
            console.log("未能找到 mall_name 字段。");
            notifications.push("未能找到 mall_name 字段。");
            sendFinalNotification("错误", "白名单店铺", notifications.join("; "));
            $done({});
        }
    } catch (error) {
        console.error("脚本执行错误: " + error);
        notifications.push("脚本执行错误: " + error);
        sendFinalNotification("错误", "脚本执行错误", notifications.join("; "));
        $done({});
    }

    function checkBlacklist(mallName, responseBody) {
        var storedMallName = $persistentStore.read("blackmailMallName");
        var mallBool = "白";

        if (!storedMallName) {
            console.log("黑名单数据为空，开始从服务器获取黑名单数据...");
            $httpClient.get("[YOUR_BLACKLIST_URL]", function(error, response, data) {
                if (error) {
                    console.error("获取黑名单数据时出错: " + error);
                    notifications.push("获取黑名单数据失败: " + error);
                    sendFinalNotification("错误", mallName + "白名单店铺", notifications.join("; "));
                    $done({});
                    return;
                }
                console.log("已从服务器获取新的黑名单数据。储存并继续流程。");
                $persistentStore.write(data, "blackmailMallName");
                mallBool = storedMallName.includes(mallName) ? "黑" : "白";
                processResponseBody(responseBody, mallBool, mallName);
            });
        } else {
            console.log("读取到的黑名单数据，正在进行校验...");
            mallBool = storedMallName.includes(mallName) ? "黑" : "白";
            notifications.push(mallBool === "黑" ? "黑名单店铺。" : "正常店铺。");
            processResponseBody(responseBody, mallBool, mallName);
        }
    }

    function processResponseBody(responseBody, mallBool, mallName) {
        analyzeProductData(responseBody, mallBool, mallName);
        sendFinalNotification("成功", mallName + (mallBool === "黑" ? "黑名单店铺" : "白名单店铺"), notifications.join("; "));
        $done({});
    }

    function analyzeProductData(responseBody, mallBool, mallName) {
        console.log("分析商品数据...");
        const maxPrice = 0.81;
        var lowestPrice = Infinity;
        var lowestPriceSkuInfo;

        try {
            // Add checks and data extraction
            console.log("价格低于设定值，可进行上传");
            uploadProductInfo(
                "product_info",
                goods_name,
                mallName,
                lowestPrice,
                goods_id,
                group_id,
                sku_id,
                detail_id,
                mall_id,
                pdd_route,
                activity_id,
                mallBool
            );
        } catch (error) {
            console.error("商品数据解析错误: " + error);
            notifications.push("商品数据解析错误: " + error);
        }
    }

    function uploadProductInfo(tableName, goods_name, mallName, price, goods_id, group_id, sku_id, detail_id, mall_id, pdd_route, activity_id, mallBool) {
        console.log("构建数据上传URL...");

        // Url should be completed according to your setting

        console.log("完成URL构建: " + url);
        $httpClient.get(url, function(error, response, data) {
            if (error) {
                console.error("上传商品信息时出错: " + error);
                notifications.push("上传商品信息失败: " + error);
            } else {
                console.log("商品信息上传成功: " + data);
                notifications.push("成功上传商品信息: " + data);
            }
            sendFinalNotification("成功", mallName + "白名单店铺", notifications.join("; "));
            $done({});
        });
    }

    function sendFinalNotification(type, title, content) {
        console.log("发送通知: " + title);
        $notification.post(type, title, content);
    }
})();
