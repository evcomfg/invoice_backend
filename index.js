const express = require("express");
const cors = require('cors');
const bodyParser = require("body-parser");
const PDFDocument = require("pdfkit");
const path = require("path");

const corsOptions = {
    origin: '*', // Allow all origins
    methods: 'GET,POST',
    allowedHeaders: 'Content-Type',
};

const app = express();
app.use(cors(corsOptions)); // Enable CORS
app.use(bodyParser.json());

const TAX_RATE = 7.25; // 7.25%

// POST endpoint to generate the invoice
app.post("/api/invoice", (req, res) => {
    const {
        customerName, billingAddress1, billingAddress2, billingCity, billingState, billingZipCode,
        shippingAddressSame, shippingCustomerName, shippingAddress1, shippingAddress2, shippingCity, shippingState, shippingZipCode,
        cartModel, basePrice, battery, battery_price, paint, paintColor, paintPrice, addOns
    } = req.body;

    if (!customerName || !billingAddress1 || !billingCity || !billingState || !billingZipCode || !cartModel || !basePrice) {
        console.error("Missing required fields.");
        return res.status(400).send("Missing required fields.");
    }

    // Calculate prices
    const batteryPrice = battery === "AMG batteries 150A-48 V (Standard)" ? 0 : battery_price;
    const addOnsTotal = addOns ? addOns.reduce((sum, addOn) => sum + (addOn.price || 0), 0) : 0;
    const subtotal = basePrice + batteryPrice + addOnsTotal + paintPrice;
    const taxAmount = subtotal * (TAX_RATE / 100);
    const totalPrice = subtotal + taxAmount;

    // Create a PDF document
    const pdfDoc = new PDFDocument({ size: 'A4', margin: 50 });

    // Set the content type to PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename=invoice.pdf');

    // Pipe the PDF document to the response
    pdfDoc.pipe(res);

    // Add logo (adjust the path to where your logo is located)
    pdfDoc.image(path.join(__dirname, 'logos/logo_green.jpg'), 50, 45, { width: 100 })
        .fontSize(16)
        .text("INVOICE", 400, 40, { align: "right" })
        .moveDown();

    // Add company information
    pdfDoc
        .fontSize(10)
        .text("EVCO Manufacturing", 400, 60, { align: "right" })
        .text("405 N Grandview St", 400, 75, { align: "right" })
        .text("Union City, OH, 45390", 400, 90, { align: "right" })
        .text("Phone: +1 (937) - 741 - 3332", 400, 105, { align: "right" })
        .moveDown();

    // Add invoice details
    pdfDoc
        .fontSize(12)
        .text(`Invoice #: `, 50, 140)
        .text(`Date: ${new Date().toLocaleDateString()}`, 50, 155)
        .moveDown();

    // Add billing and shipping information side by side
    pdfDoc
        .fontSize(12)
        .text("BILL TO:", 50, 180)
        .text(`${customerName}`, 50, 195)
        .text(`${billingAddress1}`, 50, 210)
        .text(`${billingAddress2 || ""}`, 50, 225)
        .text(`${billingCity}, ${billingState} ${billingZipCode}`, 50, 240);

    pdfDoc
        .moveTo(200, 180)
        .lineTo(200, 260)  // Draw vertical line between BILL TO and SHIP TO
        .lineWidth(2)
        .stroke();

    if (shippingAddressSame === "no") {
        pdfDoc
            .fontSize(12)
            .text("SHIP TO:", 250, 180)
            .text(`${shippingCustomerName}`, 250, 195)
            .text(`${shippingAddress1}`, 250, 210)
            .text(`${shippingAddress2 || ""}`, 250, 225)
            .text(`${shippingCity}, ${shippingState} ${shippingZipCode}`, 250, 240);
    }

    // Add table headers
    pdfDoc
        .rect(50, 270, 500, 20).fillAndStroke("#cccccc", "#000000")
        .fillColor("#000000")
        .text("DESCRIPTION", 55, 275, { width: 250, align: "left" })
        .text("UNIT PRICE", 305, 275, { width: 100, align: "center" })
        .text("TOTAL", 405, 275, { width: 95, align: "center" });

    // Add the cart model as the first item in the invoice
    pdfDoc
        .text(cartModel, 55, 295, { width: 250, align: "left" })
        .text(`$${basePrice.toFixed(2)}`, 305, 295, { width: 100, align: "center" })
        .text(`$${basePrice.toFixed(2)}`, 405, 295, { width: 95, align: "center" });

    // Add the battery as the second item in the invoice
    pdfDoc
        .text(battery, 55, 315, { width: 250, align: "left" })
        .text(`$${batteryPrice.toFixed(2)}`, 305, 315, { width: 100, align: "center" })
        .text(`$${batteryPrice.toFixed(2)}`, 405, 315, { width: 95, align: "center" });

    // Add the paint type and color
    if (paint) {
        pdfDoc
            .text(paint + (paintColor ? ` - ${paintColor}` : ''), 55, 335, { width: 250, align: "left" })
            .text(`$${paintPrice.toFixed(2)}`, 305, 335, { width: 100, align: "center" })
            .text(`$${paintPrice.toFixed(2)}`, 405, 335, { width: 95, align: "center" });
    }

    // Start adding add-ons below the base item
    let positionY = 355;
    if (addOns) {
        addOns.forEach((addOn, index) => {
            pdfDoc
                .text(addOn.name, 55, positionY + index * 20, { width: 250, align: "left" })
                .text(`$${addOn.price.toFixed(2)}`, 305, positionY + index * 20, { width: 100, align: "center" })
                .text(`$${addOn.price.toFixed(2)}`, 405, positionY + index * 20, { width: 95, align: "center" });
        });

        // Move down to the subtotal, tax, and total section
        positionY += addOns.length * 20 + 20;
    }

    pdfDoc
        .fontSize(12)
        .text("Subtotal:", 305, positionY, { align: "center" })
        .text(`$${(basePrice + batteryPrice + addOnsTotal + paintPrice).toFixed(2)}`, 405, positionY, { align: "right" });

    pdfDoc
        .fontSize(12)
        .text(`Tax (${TAX_RATE}%):`, 305, positionY + 20, { align: "center" })
        .text(`$${taxAmount.toFixed(2)}`, 405, positionY + 20, { align: "right" });

    pdfDoc
        .rect(375, positionY + 40, 190, 20).fillAndStroke("#cccccc", "#000000")
        .fillColor("#000000")
        .fontSize(12)
        .text(`Total Due: `, 305, positionY + 45, { align: "center"})
        .text(`$${totalPrice.toFixed(2)}`, 405, positionY + 45, { align: "right"})

    // Add a signature line
    pdfDoc
        .fontSize(12)
        .text("Signature: _________________________", 40, positionY + 100, { align: "left" });

    // Finalize the PDF document
    pdfDoc.end();
});

// Start the server on port 5000
app.listen(5000, () => {
    console.log("Server is running on port 5000");
});

module.exports = app;
