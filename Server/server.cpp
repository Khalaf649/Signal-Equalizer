#include <iostream>
#include <vector>
#include <complex>
#include <cmath>
#include "httplib.h" // Requires cpp-httplib library (header-only)
#include "json.hpp"  // Requires nlohmann/json library (header-only)

using json = nlohmann::json;

const double PI = std::acos(-1.0);

size_t next_power_of_2(size_t n)
{
    size_t p = 1;
    while (p < n)
    {
        p <<= 1;
    }
    return p;
}

void fft(std::vector<std::complex<double>> &a, bool invert)
{
    size_t n = a.size();
    if (n <= 1)
        return;

    std::vector<std::complex<double>> even(n / 2), odd(n / 2);
    for (size_t i = 0; i < n / 2; ++i)
    {
        even[i] = a[2 * i];
        odd[i] = a[2 * i + 1];
    }

    fft(even, invert);
    fft(odd, invert);

    double angle = 2 * PI / n * (invert ? 1 : -1);
    std::complex<double> w(1.0), wn(std::cos(angle), std::sin(angle));

    for (size_t i = 0; i < n / 2; ++i)
    {
        a[i] = even[i] + w * odd[i];
        a[i + n / 2] = even[i] - w * odd[i];
        if (invert)
        {
            a[i] /= 2;
            a[i + n / 2] /= 2;
        }
        w *= wn;
    }
}

// Helper to set CORS headers for a response
void set_cors(httplib::Response &res)
{
    res.set_header("Access-Control-Allow-Origin", "*");
    res.set_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.set_header("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

int main()
{
    httplib::Server svr;

    // Handle preflight OPTIONS requests
    svr.Options(".*", [](const httplib::Request &req, httplib::Response &res)
                {
                    set_cors(res);
                    res.status = 204; // No content
                });

    svr.Post("/calculatefft", [](const httplib::Request &req, httplib::Response &res)
             {
        set_cors(res); // Add CORS headers here

        try {
            
            auto j = json::parse(req.body);
            auto samples = j["samples"].get<std::vector<double>>();
            double fs = j["fs"].get<double>();
            

            size_t original_size = samples.size();
            size_t n = next_power_of_2(original_size);
            std::vector<std::complex<double>> data(n);
            for (size_t i = 0; i < original_size; ++i) data[i] = samples[i];

            fft(data, false);

            std::vector<double> frequencies(n / 2 + 1);
            std::vector<double> magnitudes(n / 2 + 1);
            for (size_t i = 0; i <= n / 2; ++i) {
                frequencies[i] = static_cast<double>(i) * fs / n;
                magnitudes[i] = std::abs(data[i]);
            }

            json response = {{"frequencies", frequencies}, {"magnitudes", magnitudes}};
            res.set_content(response.dump(), "application/json");
        } catch (...) {
            res.status = 400;
            res.set_content("{\"error\": \"Invalid request\"}", "application/json");
        } });

    svr.Post("/applyEqualizer", [](const httplib::Request &req, httplib::Response &res)
             {
    set_cors(res);

    try {
        auto j = json::parse(req.body);

        auto samples = j["samples"].get<std::vector<double>>();
        double fs = j["fs"].get<double>();

        struct Band { double left, right, gain; };
        std::vector<Band> bands;
        for (const auto& b : j["sliders"]) {
            bands.push_back({ b["low"].get<double>(),
                              b["high"].get<double>(),
                              b["value"].get<double>() });
        }

        size_t original_size = samples.size();
        size_t n = next_power_of_2(original_size);

        std::vector<std::complex<double>> data(n);
        for (size_t i = 0; i < original_size; ++i) data[i] = samples[i];

        // Forward FFT (frequency domain)
        fft(data, false);

        // Apply gains in frequency domain
        for (const auto& band : bands) {
            for (size_t i = 0; i <= n / 2; ++i) {
                double freq = static_cast<double>(i) * fs / n;
                if (freq >= band.left && freq <= band.right) {
                    data[i] *= band.gain;
                    if (i > 0 && i < n / 2) data[n - i] *= band.gain;
                }
            }
        }

        // ✅ Compute frequencies & magnitudes BEFORE inverse FFT
        std::vector<double> frequencies(n / 2 + 1);
        std::vector<double> magnitudes(n / 2 + 1);
        for (size_t i = 0; i <= n / 2; ++i) {
            frequencies[i] = static_cast<double>(i) * fs / n;
            magnitudes[i] = std::abs(data[i]);
        }

        // Inverse FFT → back to time-domain
        fft(data, true);

        // Extract time samples
        std::vector<double> output(original_size);
        for (size_t i = 0; i < original_size; ++i) output[i] = data[i].real();

        json response = {
            {"samples", output},
            {"frequencies", frequencies},
            {"magnitudes", magnitudes}
        };

        res.set_content(response.dump(), "application/json");

    } catch (...) {
        res.status = 400;
        res.set_content("{\"error\": \"Invalid request\"}", "application/json");
    } });

    std::cout << "Server listening on port 8080..." << std::endl;
    svr.listen("0.0.0.0", 8080);

    return 0;
}