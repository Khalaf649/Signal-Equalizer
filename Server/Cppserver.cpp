#include <iostream>
#include <vector>
#include <algorithm> 
#include <complex>
#include <cmath>
#include "httplib.h" // Requires cpp-httplib library (header-only)
#include "json.hpp"  // Requires nlohmann/json library (header-only)
using namespace std;

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
void stft(const vector<double>& samples,
          size_t windowSize,
          size_t hopSize,
          vector<vector<double>>& magnitudeFrames)
{
    // Hann window
    vector<double> window(windowSize);
    for (size_t n = 0; n < windowSize; n++)
        window[n] = 0.5 - 0.5 * cos(2 * PI * n / (windowSize - 1));

    size_t nfft = windowSize;
    vector<complex<double>> fftData(nfft);

    // Loop over frames (include the last partial one)
    for (size_t start = 0; start < samples.size(); start += hopSize)
    {
        // Reset FFT buffer
        std::fill(fftData.begin(), fftData.end(), 0.0);

        // Zero-pad last frame if shorter than windowSize
        size_t remain = samples.size() - start;
        for (size_t i = 0; i < windowSize; i++) {
            if (i < remain)
                fftData[i] = samples[start + i] * window[i];
            else
                fftData[i] = 0.0;
        }

        // Run FFT
        fft(fftData, false);

        // Magnitude (positive frequencies only)
        vector<double> magFrame(nfft / 2 + 1);
        for (size_t k = 0; k <= nfft / 2; k++)
            magFrame[k] = std::abs(fftData[k]);

        magnitudeFrames.push_back(magFrame);
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

            std::vector<double> frequencies(n/2 + 1);
            std::vector<double> magnitudes(n/2 + 1);
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

      svr.Post("/spectrogram", [](const httplib::Request& req, httplib::Response& res){
        set_cors(res);
        try {
            auto j = json::parse(req.body);
            auto samples = j["samples"].get<vector<double>>();
            double fs = j["fs"].get<double>();
            size_t windowSize = 2048;
            size_t hopSize = windowSize/4;

            vector<vector<double>> magnitudeFrames;
            stft(samples, windowSize, hopSize, magnitudeFrames);

            size_t nfft = windowSize;
            size_t numFreqBins = nfft/2 + 1;
            size_t numFrames = magnitudeFrames.size();

            // Frequency axis
            vector<double> y(numFreqBins);
            for (size_t k = 0; k < numFreqBins; k++)
                y[k] = k * fs / nfft;

            // Time axis
            vector<double> x(numFrames);
            for (size_t t = 0; t < numFrames; t++)
                x[t] = t * hopSize / fs;

            // Transpose magnitudeFrames [time][freq] -> [freq][time] for Plotly
            vector<vector<double>> z(numFreqBins, vector<double>(numFrames));
            for (size_t t = 0; t < numFrames; t++)
                for (size_t f = 0; f < numFreqBins; f++)
                    z[f][t] = magnitudeFrames[t][f];

            json response;
            response["z"] = z;
            response["x"] = x;
            response["y"] = y;

            res.set_content(response.dump(), "application/json");
        } catch (...) {
            res.status = 400;
            res.set_content("{\"error\":\"Invalid request\"}", "application/json");
        }
    });

    std::cout << "Server listening on port 8080..." << std::endl;
    svr.listen("0.0.0.0", 8080);

    return 0;
}